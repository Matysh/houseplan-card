# SPEC-REVIEW-892-r2

Issue: #892 · Этап: spec (ТЗ, PROCESS.md §2.4) · Трек: ask · Заход r2 ·
блокирующих циклов израсходовано 1/4 · Материал: тело issue #892,
`bodyDigest bbb4b4c4…` (сверен скриптом `review-doc-guard.mjs`, совпадает с
значением REVIEW_CONTEXT). Материал кода, использованный для проверки
фактических заявлений ТЗ: `6f0a3c5719073220d59c00a3e1b74a6e289197c2` (рабочая
копия, `git rev-parse HEAD` сверен).

## Скоуп

Без изменений относительно r1: ТЗ (J6, Plan maintenance) правит четыре
поверхности — права запуска Optimize/Optimize Undo в
`general-settings-dialog`/`optimize-plans-dialog`, предупреждение о
непроверенных маршрутах пылесоса, разделение report на видимые позиции и
позиции отсутствующих этажей, правило `scripts/model-invariants.mjs` для
legacy `grp_<area>`. Дубликат #869 исключён из скоупа. Round r2 — ответ на
находку M1 из r1, тело issue правлено точечно (раздел «Дельта r2» в конце),
остальные разделы контракта/AC не тронуты.

## Как проверялось

Читал тело issue #892 целиком (из REVIEW_CONTEXT), все пять текущих
комментариев issue (оценка автора, хендофф, вердикт конвейера r1, дельта r2
автора, повторный хендофф — все от `Matysh`, трек `ask` подтверждён
меткой/комментарием владельца), документ `docs/reviews/SPEC-REVIEW-892-r1.md`
целиком. Делал не повторную проверку задачи целиком, а разбор по дельте
(`docs/process/REVIEWER.md`, «Повторный раунд»): дельта текстовая и
локальная (одна находка, один раздел контракта/AC, явное наследование
остального автором) — оснований для полного разбора не нашёл.

Перечитал фактический материал кода на точном SHA `6f0a3c57` (рабочая копия
уже на нём) для находки M1 и её закрытия:
`custom_components/houseplan/auth.py` (`may_write`, строки 17-55),
`websocket_api.py` (`ws_plan_optimize`/`_undo`, тексты ошибок строки 2279 и
её аналог у undo), `src/editors/general-settings-dialog.ts` (кнопки Optimize/
Undo, строки ~256-287), `src/houseplan-card.ts` (`_canEdit` — реактивный
геттер `_norm && _canManageConfiguration`, строка 1010, и уже существующий
паттерн гейтинга `${host._canEdit ? ... : nothing}` на соседней секции
backup), `src/optimize-plans-dialog.ts` (`open()` не содержит собственной
проверки прав — полагается на вызывающую сторону), `docs/USER-GUIDE.ru.md`
(строка 205) и `docs/USER-GUIDE.md` (строка 200).

Гейты: `node scripts/review-preflight.mjs` не смог обратиться к `gh api`
без репозиторного контекста CI (ожидаемо вне пайплайна), поэтому вызвал
экспортированную функцию `specFormatErrors(body, 'ask', false)` из
`scripts/review-preflight.mjs` напрямую на теле issue из REVIEW_CONTEXT —
результат `[]` (PASS, подтверждает заявление автора). `typecheck`/`npm test`/
`npm run build` не гонял: `node_modules` отсутствует (зависимости на этапе
spec не ставились, #696), продуктовый код этим раундом не менялся — гейты
нечего защищать. Это согласуется с решением r1 и с «Объём гейтов» в
`docs/process/REVIEWER.md` (полные наборы — предрелизный гейт).

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium M1: «backend требует HA-admin» — не подтверждается кодом (`may_write` пропускает non-admin writer при `admin_only=false`); Контракт п.1/AC1 по факту вводили новое ограничение `is_admin` в обход `admin_only=false` без продуктового вопроса владельцу | Автор выбрал вариант (b) из рекомендации r1: премиса снята, ограничение `is_admin` НЕ вводится. Контракт п.1 переписан на «неизменному backend may_write: admin_only=true только admin; admin_only=false admin и ordinary household writer»; фронтенд обязан проверять **текущий подтверждённый `can_write`**, а не вводить более строгий гейт. AC1 переписан: «ordinary writer проходит только admin_only=false … backend behavior совпадает до/после, without new is_admin gate … Краснеет при отсутствии frontend write guard и при blanket is_admin запрете writers» — защита симметрична в обе стороны (ни дыры, ни избыточного ограничения). Раздел «Скоуп и не-скоуп» добавил явный запрет: «Нового ограничения is_admin в обход admin_only=false не вводить». USER-GUIDE правки включены явной строкой в дельте: «Исправить USER-GUIDE.ru.md строку «всегда требует администратора» и EN-аналог, а также устаревший unauthorized English text» | Тело issue, разделы «Скоуп и не-скоуп», «Контракт поведения» п.1, AC1, «Дельта r2» (нижний раздел тела); код-референс самого найденного пробела — `src/editors/general-settings-dialog.ts:278-282` (кнопка `gs.align_all` вне `host._canEdit`, в отличие от секции backup строкой выше), `docs/USER-GUIDE.ru.md:205`, `docs/USER-GUIDE.md:200` (строки, которые предстоит поправить реализацией) |

Проверил на материале кода `6f0a3c57`, что закрытие технически исполнимо, а
не просто сформулировано правильно: `_canEdit` в `src/houseplan-card.ts:1010`
— реактивный геттер (`_norm && _canManageConfiguration`), пересчитывается на
каждом рендере; соседняя секция backup в том же файле уже обёрнута в
`${host._canEdit ? ... : nothing}` (строка 259) — то есть «frontend entry …
проверяет текущий подтверждённый can_write» для кнопки Optimize ровно тот же,
уже работающий в этом диалоге паттерн, а не новый механизм. Риск
нереализуемости — низкий. `src/optimize-plans-dialog.ts:247` (`open()`)
подтверждает, что единственная точка входа в диалог — вызов из
`general-settings-dialog.ts:280`, других путей открытия («direct open») в
коде нет — формулировка AC1 не предполагает скрытую вторую дверь, которую
придётся ловить отдельно.

## Унаследовано из r1 (без повторной проверки)

- **Контракт п.2 (vacuum warning)** и соответствие `docs/VACUUM.md` (путь
  «Редактор устройств → пылесос → карты»), ключ `gs.optimize_vacuum_warning`.
- **Контракт п.3 (moved/maxShift, разделение видимых/отсутствующих позиций)**
  и соответствие `src/align-grid.ts:345-360`.
- **Контракт п.4 (model-invariants, legacy `grp_<area>`)** и расхождение
  `scripts/model-invariants.mjs:222-229` vs. `src/space-reference-repair.ts:373-377`.
- **AC2, AC3, AC4, AC5** — формулировки, способ доказательства, «чем
  краснеет».
- **Дубликат #869** и границы скоупа относительно него.
- **Обязательные разделы §7.1** присутствуют и однозначны (кроме дельты,
  уже разобранной выше).
- **Release-артефакты**: `User-Visible: yes`, оба CHANGELOG, USER-GUIDE RU/EN
  заявлены.

Документ: `docs/reviews/SPEC-REVIEW-892-r1.md`, материал r1 — тело issue
`bodyDigest cd01e1d3…`, код `ef1aeaf6cf94`. Дельта автора (раздел «Дельта r2»
в теле issue) сама объявляет, что п.2–4 контракта и AC2–5 унаследованы без
изменения; сверка выше (сравнение текущего тела с цитатами r1) подтверждает,
что текст этих разделов не менялся буква в букву.

## Находки

Нет. High: 0, Medium: 0.

### Что проверено и корректно

- Закрытие M1 — см. таблицу выше; закрытие предметное (переписан контракт
  и AC, не просто формулировка), подтверждено чтением кода на точном SHA
  материала, а не на доверии к тексту дельты.
- Симметрия защиты AC1 (красит и недостающий gate, и избыточный
  `is_admin`-гейт) — корректный способ не допустить повторения того же
  класса ошибки (продуктовое ужесточение, поданное как починка) при
  реализации.
- `specFormatErrors` — PASS на теле issue после правки (разделы
  Сценарий/до-после/Проблема/Скоуп/не-скоуп/Контракт/UX/данные/i18n/AC/
  тесты/риски/откат/релиз все присутствуют).
- Открытых продуктовых вопросов владельцу в теле нет; единственный открытый
  вопрос r1 снят автором с явным обоснованием выбора (b), а не оставлен
  как технический вопрос владельцу.

## Чего не проверял

- `typecheck`/`npm test`/`npm run build`, golden, smoke, pytest, invariants —
  не гонял: этап `spec`, продуктовый код этим раундом не менялся,
  `node_modules` не установлены (#696). Полные наборы — предрелизный гейт,
  их место — код-ревью после реализации.
- `docs/release-ledger/<previous-stable>/892.json` — файл ещё не существует
  (создаётся на этапе реализации/мерджа); классификация
  major/infra/stable-fix/line-fix проверяется на код-ревью.
- Не переоткрывал п.2-4 контракта и AC2-5 заново с нуля — раздел
  «Унаследовано из r1» выше объясняет почему (текст не менялся, дельта
  локальна, `docs/process/REVIEWER.md` разрешает не повторять пригодный
  неизменившийся check).
- Не воспроизводил живьём на плане владельца исходные F88-F91 — как и в r1,
  это вне материала ревью (аналитика перенесена в тело issue, которое и есть
  предмет этапа spec).

## Вердикт

Находка r1 закрыта предметно и проверяемо; новых находок нет. High: 0,
Medium: 0.

---

## Материал раунда

- Ветка: `dev` (рабочая копия detached на коммите материала).
- SHA материала кода: `6f0a3c5719073220d59c00a3e1b74a6e289197c2`.
- Дерево материала: `b6c20885a21fc719b2484782d49ecb3477268507`.
- Тело issue: `bodyDigest bbb4b4c43d2e32a0b6f3fc818bc37142aba17459f449949479eff71670379bc3`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `6f0a3c571907` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b6c20885a21fc719b2484782d49ecb3477268507`
  ```
  git log --all --format='%H %T' | grep b6c20885a21f
  ```
- Тело issue: `bbb4b4c43d2e32a0b6f3fc818bc37142aba17459f449949479eff71670379bc3`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQxMDcsIm91dHB1dF90b2tlbnMiOjE2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0MTg3MDAwMDAwMDAwMDAxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo0Niwib3V0cHV0X3Rva2VucyI6MTU3NDQsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6Njc5NTksImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxNjYxNDExLCJjb3N0VXNkRXN0aW1hdGUiOjAuNzYxNjUwMTk5OTk5OTk5OH1dLCJ0dXJucyI6MzQsImR1cmF0aW9uTXMiOjE4NDM1MSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNzY1ODM3MiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4153 output_tokens=15760 cache_creation_input_tokens=67959 cache_read_input_tokens=1661411 num_turns=34 -->
