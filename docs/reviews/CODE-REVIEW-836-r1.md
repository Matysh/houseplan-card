# CODE-REVIEW-836-r1

Материал: `47bc241c00bf583e6d41ba13b2684b65b90c2167` (`git rev-parse HEAD` сверен,
совпадает). Диапазон: `git diff origin/dev...HEAD`, 5 коммитов (`8994ddd0` …
`47bc241c`). Трек: `ask`. Заход r1, блокирующих циклов 0/4.

## Скоуп

Идентичность dev-сборки (#836): метка `BUILD.json` + суффикс `+dev.<sha8>` в
`manifest.json` опубликованной ветки `dev-build` (К1); бэкенд читает метку и
отпечаток фронтенда один раз при настройке записи и кладёт их в URL модулей
карточки/панели и в `config/get` (К2–К4); карточка узнаёт себя (entry-seam,
К5), сверка версий (#462) сравнивает отпечатки при равных версиях (К6);
отображение в консоли/«О программе»/окне сверки (К7); метка в экспорте,
пакете поддержки и relay (К8). Спецификация — тело issue, раздел `## ТЗ`;
ревью ТЗ прошло зелёным (`SPEC-REVIEW-836-r1`, r1, 0 циклов).

## Как проверялось

| Гейт | Статус | Результат |
| --- | --- | --- |
| Push-Validate на `47bc241c` | учтён, не перегонялся | [run 37965359510](https://github.com/Matysh/houseplan-card/actions/runs/37965359510) — success; покрывает typecheck, `npm test`, `npm run build`+`bundle-policy --verify`, **полный `pytest tests_backend` под настоящей HA** (job «Бэкенд: pytest в Home Assistant», файл `validate.yml` подтверждён чтением), `scripts/support-relay/tests` |
| `npx tsc --noEmit` | прогнан сам | 0 ошибок |
| `node --test test/dev-build.test.mjs test/version-recovery.test.mjs test/build-identity.test.mjs test/bundle-assets.test.mjs` | прогнан сам (после `tsc -p tsconfig.test.json` + `scripts/fix-test-build.mjs`) | 78/78 passed |
| `node scripts/mutation-gate.mjs --check` | прогнан сам | exit 0, реестр целостен, браузерные гарды 291/200 (ориентир, не провал) — без изменения относительно `dev` |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнан сам | зарегистрированная связь → `demo/smoke_build_identity.mjs`, `demo/smoke_version_recovery.mjs`, `demo/smoke_editor_styles_lazy.mjs` |
| `npm run bundle:sync` + `node demo/smoke_build_identity.mjs` | прогнан сам (production-бандл, Chromium 151.0.7922.34 = пин) | OK, все 8 проверок `true` |
| `node demo/smoke_version_recovery.mjs` | прогнан сам | OK, все проверки `true`, включая `sameVersionOtherBuildShowsLabelledNotice` и `matchingBuildRemovesNotice` (AC5) |
| `node demo/smoke_editor_styles_lazy.mjs` | прогнан сам | OK, все проверки `true` (задета `editor-dialogs.styles.ts`) |
| `npm run bundle:clean` | прогнан сам после смоков | бандл восстановлен к закоммиченному, `git status` чист |

Чего не проверял и почему:
- `pytest tests_backend` и relay-тесты сам не гонял: в песочнице нет HA-харнесса
  (`.venv-backend` отсутствует, `python3 -c "import homeassistant"` падает) —
  зелёный прогон без него доказал бы только «не упал на коллекции», поэтому
  полагаюсь на тот же прогон под настоящей HA в Validate на этом SHA
  (строка выше), а не на локальный суррогат.
- Мутанты не применял — это против правил ревью на всех треках («Мутанты в
  разработке не гоняются ни на каком треке — ревьюер их тоже не применяет»);
  проверил, что защита каждого из 5 новых мутантов (`dev-build-label-in-
  integration-tree`, `version-recovery-ignores-build-fingerprint`, `frontend-
  module-url-ignores-build-fingerprint`, `support-relay-accepts-any-build`,
  `entry-wrapper-skips-url-seam`) названа в реестре `guard`-командой, и что
  эта команда указывает на реально существующий тест (прочитал имена тестов
  в `test/dev-build.test.mjs`, `test/version-recovery.test.mjs`,
  `tests_backend/test_ha_frontend_registration.py`,
  `tests_backend/test_ha_panel_registration.py`,
  `scripts/support-relay/tests/test_relay.py`, `test/bundle-assets.test.mjs` —
  все совпадают буквально).
- Golden и прочие пиновые браузерные смоки (`smoke_support_feedback` и др.) —
  вне связи по диффу (`smoke-select` их не назвал), и это не риск отрисовки
  плана: golden не меняются (в харнессе нет `dev=`/`frontend_fingerprint`,
  подтверждено автором и логикой кода — параметры появляются только при
  наличии `BUILD.json`/`houseplan-assets.json` соответствующей формы).
  `ci:golden` на задаче не стоит.
- Performance-гейт не прогонял: AC его не называют, изменение — чтение двух
  маленьких файлов один раз при настройке записи, не в рантайме карточки;
  в ТЗ это явно отмечено.
- Full registry mutants (ночной прогон) — вне объёма ревью по правилам §2.7
  (track:ask не обязывает к ночному прогону в раунде).

## Риск по изменённым участкам (#707, трек ask)

Сверка каждого флагованного класса с пунктом контракта ТЗ:

| Класс | Участок | Пункт ТЗ |
| --- | --- | --- |
| migration | `import_export.py:515` (параметр `build` в `create_export`) | К8/AC7: поле `build` в документе экспорта только при метке, байты релиза/беты не меняются — подтверждено `tests_backend/test_ha_import_export.py` |
| migration | `store.py:15`, `store.py:119` (импорт `BuildIdentity`, поле `build_identity: BuildIdentity = UNKNOWN_BUILD`) | К2: метка/отпечаток читаются один раз при настройке записи. `HouseplanData` — `entry.runtime_data`, **не сериализуется** Store (докстринг класса: «Runtime data of the single config entry»), поэтому это не правка схемы хранилища и не риск миграции по существу, несмотря на имя файла — поле с дефолтом не меняет ни одну версию стораджа (`STORAGE_MINOR_VERSION` не тронут) |
| devices | `websocket_api.py:26` (импорт), `websocket_api.py:311–314` (`_build_identity`), и ещё 5 (`ws_export_create` передача `build=`, два новых поля `config/get`, `ws_support_preview` чтение и передача `build`) | К2–К4, К8: единственное новое ветвление в devices-ориентированном файле — чтение уже посчитанной на этапе setup идентичности (`rt.build_identity`) и проброс в три существующих WS-команды; ни одна команда устройств/сущностей не затронута по смыслу |

Все классы прослеживаются до пункта контракта и AC; `reclassify` не требуется,
скоуп `ask` обоснован (меняется контракт сверки #462 и формат URL
регистрации — так и заявлено автором).

## Находки

Нет. High: 0, Medium: 0.

## Что проверено и корректно

- **К1 (`scripts/dev-build.mjs`)**: `labelManifestText` заменяет только
  верхнеуровневый `version`, проверено чтением алгоритма (перебор всех
  текстовых вхождений `"version":`, принятие только того, что даёт байтово
  ожидаемый JSON) и тестом `#836 labelManifestText: только верхнеуровневая
  version, суффикс не удваивается` — кейс с вложенным `"version"` внутри
  строкового значения и внутри дочернего объекта оба красны без фикса/зелены
  с ним. Отказ на уже содержащемся `+` в версии — задокументированное
  отступление от ТЗ (двойной `+dev` невалиден для загрузчика HA), подтверждён
  негативным тестом `test_issue_836_ha_loader_rejects_a_doubled_build_suffix`
  (настоящий `loader.async_get_integration`, не regex-копия).
  `integrationTree` считается до записи метки и манифеста — подтверждено и
  чтением порядка операций в `buildDevBuildCommit`, и тестом «два источника с
  одной интеграцией и разными SHA — один `integrationTree`».
- **К2 (`build_identity.py`)**: 12 параметризованных негативных кейсов на
  `BUILD.json` (битый JSON, массив, не-`dev` канал, короткий/заглавный/с
  переносом `source`, `schema` не `1` и `schema=True`, отсутствие `schema`,
  неразбираемые байты) и 8 — на `houseplan-assets.json`; каждый кейс явно
  утверждает «сосед не испорчен» (битая метка не прячет отпечаток и
  наоборот). `read_build_identity` не поднимает исключение даже при
  `IsADirectoryError` и при форсированном `RuntimeError` внутри `_read_json`
  (тест подменяет функцию и проверяет возврат `UNKNOWN_BUILD`).
- **К3 (URL модулей)**: `frontend_module_url` при отсутствии обоих — ровно
  `?v=<VERSION>`; тест на уровне интеграции (`test_issue_836_setup_reads_
  identity_once_off_the_loop_and_registers_urls`) проверяет и то, что чтение
  происходит один раз на весь setup записи (не на каждый `config/get`), и
  что это происходит в executor (`threading.get_ident()` отличается от
  потока event loop).
- **К4 (`config/get`)**: `frontend_fingerprint`/`build` — отдельные поля,
  `integration_version` не меняется (явная проверка в тесте AC4).
- **К5 (entry-seam)**: `recordEntryUrl` вставлен ДО `try{...await
  import(...)}, пишет при каждой загрузке через `??=` — выигрывает первый;
  подтверждено смоком на production-бандле (`panelEntryRecordsItsUrlBeforeC
  hunks` — панель первой, но консольный баннер карточки уже называет SHA
  панели).
- **К6 (сверка)**: отпечаток участвует в сравнении только когда известен с
  обеих сторон (`knownFingerprint` с обеих сторон обязателен) — ровно то,
  что заявлено как «отступление от ТЗ» №2 и буквально требуется AC5. Цель
  киоска `reloadTarget` подменяется только при `kind === 'mismatch'` (охрана
  в `_reconcile`/`_armTimer`), так что `target` не обращается к `undefined`
  в недостижимых ветках.
- **К7 (отображение)**: формат `<версия> · dev <sha8>` / `<версия> ·
  <fp8>` / `<версия>` — `formatBuild`, покрыт юнит-тестами и smoke
  (`consoleNamesDevBuild`, `aboutNamesDevBuildWithCommitLink` со ссылкой,
  `target=_blank`, `rel=noopener noreferrer`, фокусируемостью — все
  зелёные на реальном DOM).
- **К8 (экспорт/поддержка/relay)**: `support_package.py` и `import_export.py`
  добавляют `build` только при метке (пустой дикт в экспорте при `build=None`
  не создаёт ключ — через `**({...} if build else {})`); relay
  (`check_build`) требует ровно `{channel, source}` замкнутым набором ключей,
  отклоняет 10 вариантов искажения (включая лишний ключ `extra`, список,
  `None`, строку) — `test_malformed_build_section_is_rejected`, и
  гарантирует, что ни один невалидный пакет не долетел до провайдера
  (`self.provider.calls == []`).
- **Трейлеры**: каждый некомментарийный коммит несёт `Issue: #836` и
  `User-Visible:`; `User-Visible: yes` стоит ровно на `370785a9`, и в этом же
  коммите правки `docs/CHANGELOG.md`+`docs/CHANGELOG.ru.md` (проверено
  `git show --stat`). Формулировка в обоих файлах — параллельна, с одной и
  той же ссылкой на issue.
- **Release-ledger**: `docs/release-ledger/v1.80.1/836.json` —
  `category: "stable-fix"`, обоснование опирается на то, что регистрация
  ресурса и сверка #462 уже были частью `v1.80.1`: задача чинит слепоту
  существующего стабильного поведения, а не вводит новую бета-фичу —
  рассуждение корректно, `introducedBy` не требуется (правка не внутри-
  бетная относительно уже вышедшего стабильного).
- **Одно число — один источник**: единственная цифра, которая появляется и
  в UI, и во внутреннем состоянии — короткий SHA/отпечаток (`sha8`/`fp8`).
  Источник у консоли и «О программе» один (`entryBuildLabel()` читает один и
  тот же `globalThis.__HOUSEPLAN_ENTRY_URL__`, записанный один раз первой
  загрузившейся обёрткой); окно сверки берёт фронтенд-сторону оттуда же, а
  бэкенд-сторону — из последнего `config/get`. Расхождения источника нет.
- **Риск по участкам** (#707) — см. таблицу выше, все классы покрыты.

## Чего не проверял

См. таблицу «Как проверялось» выше — HA-харнесс (полагаюсь на Validate CI),
мутанты (запрещено применять на ревью), golden/прочие браузерные смоки (вне
связи по диффу), performance (не назван в AC).

## Вердикт

Зелёный. Код реализует К1–К8 полностью, каждый AC либо доказан автотестом с
подтверждённой падучестью (параметризованные негативные кейсы, мутанты с
`guard`, указывающим на реальный тест), либо проверен мной исполнением
(смоки на production-бандле в этой сессии). Защитные AC (К2 парсинг меток,
К3 URL-контракт, К8 relay) имеют непустой третий столбец «чем краснеет» —
мутант в реестре либо отрицательный тест-кейс внутри самого теста.
Отступления от ТЗ задокументированы автором и верны по существу (двойной
`+dev` невалиден для HA-загрузчика; симметричное условие «оба известны» для
отпечатка — буквальное прочтение AC5). Трейлеры и changelog на месте,
release-ledger обоснован.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/836-dev-build-identity`, коммит `47bc241c00bf` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `282449faf2c058c3b08ae21ca877c4cb423a89f7`
  ```
  git log --all --format='%H %T' | grep 282449faf2c0
  ```
- Тело issue: `4a9ecd2f561d4376755bb22b5122e18f695e696be36b436c62c80f5f3c21af9b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4487 output_tokens=30886 cache_creation_input_tokens=181159 cache_read_input_tokens=6678980 num_turns=67 -->
