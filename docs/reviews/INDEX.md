# Индекс ревью

Генерируется `node scripts/reviews-index.mjs` (#635) — не редактировать руками. Документов: 120, issue: 58. Вердикт: 🟢 зелёный · 🟡 жёлтый · 🔴 красный · ⚪ не распознан (свободная форма старых документов). H/M — число High/Medium по строке вердикта или заголовкам находок. Файлы — пути, названные в находках; ищите по имени файла: `grep form-kit INDEX.md`.

| Issue | Документ | Этап · раунд | Вердикт | H | M | Находки | Файлы |
|---|---|---|---|---:|---:|---|---|
| #977 | [SPEC-REVIEW-977-r1.md](SPEC-REVIEW-977-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | неверные пути i18n-файлов в «Файлы и архитектурная граница» (не блокирует) | `src/i18n/en.ts` `src/i18n/ru.ts` |
| #977 | [CODE-REVIEW-977-r1.md](CODE-REVIEW-977-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #976 | [SPEC-REVIEW-976-r1.md](SPEC-REVIEW-976-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #975 | [CODE-REVIEW-975-r1.md](CODE-REVIEW-975-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #974 | [CODE-REVIEW-974-r1.md](CODE-REVIEW-974-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #973 | [SPEC-REVIEW-973-r1.md](SPEC-REVIEW-973-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #973 | [CODE-REVIEW-973-r1.md](CODE-REVIEW-973-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #973 | [CODE-REVIEW-973-r2.md](CODE-REVIEW-973-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #972 | [SPEC-REVIEW-972-r1.md](SPEC-REVIEW-972-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #972 | [CODE-REVIEW-972-r1.md](CODE-REVIEW-972-r1.md) | code · r1 | 🟡 жёлтый | 0 | 1 | дублирующая запись в обоих changelog; demo/golden/matrix.mjs — у OPENING_SYMBOL_EXISTING_GOLDEN_IMPACT, STAGE6_ACCEPTANCE_SCE… | `docs/CHANGELOG.md` `docs/CHANGELOG.ru.md` `demo/golden/matrix.mjs` |
| #972 | [CODE-REVIEW-972-r2.md](CODE-REVIEW-972-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #971 | [CODE-REVIEW-971-r1.md](CODE-REVIEW-971-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #971 | [CODE-REVIEW-971-r2.md](CODE-REVIEW-971-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #970 | [CODE-REVIEW-970-r1.md](CODE-REVIEW-970-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #969 | [CODE-REVIEW-969-r1.md](CODE-REVIEW-969-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | демонстрационный, не нагрузочный тест на "assertion survives cleanup" | `test/dev-build.test.mjs` `docs/process/REVIEWER.md` |
| #968 | [CODE-REVIEW-968-r1.md](CODE-REVIEW-968-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #967 | [CODE-REVIEW-967-r1.md](CODE-REVIEW-967-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #967 | [CODE-REVIEW-967-r2.md](CODE-REVIEW-967-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #966 | [CODE-REVIEW-966-r1.md](CODE-REVIEW-966-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #965 | [CODE-REVIEW-965-r1.md](CODE-REVIEW-965-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #964 | [CODE-REVIEW-964-r1.md](CODE-REVIEW-964-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #963 | [SPEC-REVIEW-963-r1.md](SPEC-REVIEW-963-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | Раздел «План автотестов и релизные артефакты» / §10 / §12 называет changelog RU+EN, док… | — |
| #963 | [CODE-REVIEW-963-r1.md](CODE-REVIEW-963-r1.md) | code · r1 | 🟡 жёлтый | 0 | 1 | потеряна содержательная подсказка двух кнопок панели инструментов редактора устройств | `src/houseplan-editor-runtime.ts` `en.json` `app.mjs` `houseplan-card.css` |
| #963 | [CODE-REVIEW-963-r2.md](CODE-REVIEW-963-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #962 | [CODE-REVIEW-962-r1.md](CODE-REVIEW-962-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #961 | [CODE-REVIEW-961-r1.md](CODE-REVIEW-961-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #961 | [CODE-REVIEW-961-r2.md](CODE-REVIEW-961-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #960 | [CODE-REVIEW-960-r1.md](CODE-REVIEW-960-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | Windows-ветка candidate-reviews-index.mjs не инъецируется по платформе, поэтому не испо… | `candidate-reviews-index.mjs` `scripts/candidate-reviews-index.mjs` `scripts/local-gate-environment.mjs` `test/development-loop-954.test.mjs` `test/candidate-reviews-index.test.mjs` `test/pre-push-gate.test.mjs` |
| #959 | [CODE-REVIEW-959-r1.md](CODE-REVIEW-959-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #958 | [CODE-REVIEW-958-r1.md](CODE-REVIEW-958-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #957 | [CODE-REVIEW-957-r1.md](CODE-REVIEW-957-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #956 | [SPEC-REVIEW-956-r1.md](SPEC-REVIEW-956-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #956 | [CODE-REVIEW-956-r1.md](CODE-REVIEW-956-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | 5 smoke с «прямым совпадением» не были прогнаны автором (закрыто при ревью) | `smoke_plan_drawing_repairs.mjs` `smoke_plan_snap_overlay.mjs` `smoke_room_autoclose.mjs` `smoke_unified_wall_tool.mjs` `smoke_wall_union_isolation.mjs` `docs/TESTING.md` `src/houseplan-card.ts` |
| #956 | [CODE-REVIEW-956-r2.md](CODE-REVIEW-956-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #956 | [CODE-REVIEW-956-r3.md](CODE-REVIEW-956-r3.md) | code · r3 | 🟢 зелёный | 0 | 0 | — | — |
| #955 | [SPEC-REVIEW-955-r1.md](SPEC-REVIEW-955-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | Не назван эффект на производительность/бюджеты (PROCESS.md §2.5, п. DoR). Файл: тело is… | — |
| #955 | [SPEC-REVIEW-955-r2.md](SPEC-REVIEW-955-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #955 | [SPEC-REVIEW-955-r3.md](SPEC-REVIEW-955-r3.md) | spec · r3 | 🟢 зелёный | 0 | 0 | — | — |
| #955 | [CODE-REVIEW-955-r1.md](CODE-REVIEW-955-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #954 | [CODE-REVIEW-954-r1.md](CODE-REVIEW-954-r1.md) | code · r1 | 🟡 жёлтый | 0 | 0 | — | — |
| #953 | [CODE-REVIEW-953-r1.md](CODE-REVIEW-953-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #952 | [CODE-REVIEW-952-r1.md](CODE-REVIEW-952-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #951 | [CODE-REVIEW-951-r1.md](CODE-REVIEW-951-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #950 | [CODE-REVIEW-950-r1.md](CODE-REVIEW-950-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #949 | [CODE-REVIEW-949-r1.md](CODE-REVIEW-949-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #949 | [CODE-REVIEW-949-r2.md](CODE-REVIEW-949-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #948 | [SPEC-REVIEW-948-r1.md](SPEC-REVIEW-948-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #948 | [CODE-REVIEW-948-r1.md](CODE-REVIEW-948-r1.md) | code · r1 | 🟡 жёлтый | 0 | 3 | Medium — автоопределение ZHA не отличает игнорируемую запись от настроенной (devices, §…; Medium — две независимые кнопки отмены одновременно (§10 ТЗ, AC14); Medium — у опций hp-settings-select нет анимированного hover/active-перехода (ux, уточн…; / к сведению (не блокируют, записаны для автора) | `settings-dialogs.styles.ts` `sun-settings-view.ts` |
| #948 | [CODE-REVIEW-948-r2.md](CODE-REVIEW-948-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | числа бюджета бандла в комментариях bundle-budget.mjs трудно проверить построчно | `bundle-budget.mjs` `scripts/bundle-budget.mjs` |
| #947 | [SPEC-REVIEW-947-r1.md](SPEC-REVIEW-947-r1.md) | spec · r1 | 🔴 красный | 1 | 1 | AC5 и раздел «Модель данных» молча убирают единственный способ завести НОВЫЙ радар пяти…; раздел «Модель данных» предписывает добавить | `src/houseplan-editor-runtime.ts` `src/editors/radar-section.ts` `docs/RADAR.md` `docs/SCOPE.md` `src/radar-editor.ts` `docs/CONFIG-COMPATIBILITY.md` `src/types.ts` `src/device-signal.ts` |
| #947 | [SPEC-REVIEW-947-r2.md](SPEC-REVIEW-947-r2.md) | spec · r2 | 🟡 жёлтый | 0 | 1 | новый пункт раздела «Модель данных» подтверждает удаление единственного пути настройки …; абзац «Модель данных и совместимость» не отредактирован и дословно противоречит более п… | `AGENTS.md` `docs/RADAR.md` `docs/USER-GUIDE.ru.md` `src/editors/marker-dialog.ts` `hp-device-preview.ts` |
| #947 | [SPEC-REVIEW-947-r3.md](SPEC-REVIEW-947-r3.md) | spec · r3 | 🟡 жёлтый | 0 | 1 | новый раздел «Документация» сужает объём правки docs/RADAR.md до одного подраздела, но … | `docs/RADAR.md` `docs/USER-GUIDE.ru.md` |
| #947 | [SPEC-REVIEW-947-r4.md](SPEC-REVIEW-947-r4.md) | spec · r4 | 🟢 зелёный | 0 | 0 | — | — |
| #947 | [SPEC-REVIEW-947-r5.md](SPEC-REVIEW-947-r5.md) | spec · r5 | 🟡 жёлтый | 0 | 1 | документация устройства не ограничивается разделом про радар, а ТЗ называет только его; слипшееся предложение в AC1 | `docs/USER-GUIDE.ru.md` `docs/USER-GUIDE.md` `docs/SCOPE.md` |
| #947 | [CODE-REVIEW-947-r1.md](CODE-REVIEW-947-r1.md) | code · r1 | 🟡 жёлтый | 0 | 1 | потеря возможности отменить «Remove» у устаревшего; задвоенный абзац футера в английском гайде | `docs/RADAR.md` `marker-dialog.ts` `radar-section.ts` `demo/smoke_radar_setup.mjs` `docs/USER-GUIDE.md` `docs/USER-GUIDE.ru.md` |
| #947 | [CODE-REVIEW-947-r2.md](CODE-REVIEW-947-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #946 | [SPEC-REVIEW-946-r1.md](SPEC-REVIEW-946-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | «связанный переход» Room → Space входит в AC5, но не | `room-settings-v4.html` `.fragment.html` `.data.json` `README.md` `draft-decisions.md` `docs/USER-GUIDE.ru.md` |
| #946 | [SPEC-REVIEW-946-r2.md](SPEC-REVIEW-946-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #946 | [SPEC-REVIEW-946-r3.md](SPEC-REVIEW-946-r3.md) | spec · r3 | 🟢 зелёный | 0 | 0 | — | — |
| #946 | [CODE-REVIEW-946-r1.md](CODE-REVIEW-946-r1.md) | code · r1 | 🟡 жёлтый | 0 | 1 | «Нет» вместо «Без заливки» в опции select «Режим заливки» (AC1) | `src/editors/room-settings-dialog.ts` `src/i18n/ru.json` `docs/design/settings-dialogs-944/room-settings-v4.html` `room-settings-dialog.ts` `room-settings-v4.html` `demo/smoke_dialog_config_parity.mjs` `docs/USER-GUIDE.ru.md` |
| #946 | [CODE-REVIEW-946-r2.md](CODE-REVIEW-946-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | мёртвая ссылка на удалённый ключ fill.none в demo-смоке (не блокирует) | `demo/smoke_ux_fixes.mjs` `src/i18n.ts` |
| #945 | [SPEC-REVIEW-945-r1.md](SPEC-REVIEW-945-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | «Затронутые модули»/модель данных не называют три | `custom_components/houseplan/import_export.py` `custom_components/houseplan/support_package.py` `custom_components/houseplan/support_wire_schema.py` `tests_backend/test_support_package.py` `docs/SCOPE.md` `validation.py` `docs/reviews/SPEC-REVIEW-943-r1.md` `support_package.py` |
| #945 | [SPEC-REVIEW-945-r2.md](SPEC-REVIEW-945-r2.md) | spec · r2 | 🟡 жёлтый | 0 | 1 | новое/переименованное поле локального режима заряда устройств пространства нигде не наз… | — |
| #945 | [SPEC-REVIEW-945-r3.md](SPEC-REVIEW-945-r3.md) | spec · r3 | 🟢 зелёный | 0 | 0 | — | — |
| #945 | [CODE-REVIEW-945-r1.md](CODE-REVIEW-945-r1.md) | code · r1 | 🟡 жёлтый | 0 | 1 | src/editors/room-settings-dialog.ts:271-272 | `src/editors/room-settings-dialog.ts` `src/logic.ts` `src/houseplan-card.ts` `src/space-render.ts` `houseplan-card.ts` `room-settings-dialog.ts` `docs/CONFIG-COMPATIBILITY.md` `CONFIG-COMPATIBILITY.md` |
| #945 | [CODE-REVIEW-945-r2.md](CODE-REVIEW-945-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #943 | [SPEC-REVIEW-943-r1.md](SPEC-REVIEW-943-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | «Затронутые модули» не называют parity-контракт | `validation.py` `custom_components/houseplan/support_package.py` `custom_components/houseplan/support_wire_schema.py` `docs/SUPPORT-PRIVACY.md` `tests_backend/test_support_package.py` `src/logic.ts` `logic.ts` `support_package.py` |
| #943 | [SPEC-REVIEW-943-r2.md](SPEC-REVIEW-943-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #943 | [CODE-REVIEW-943-r1.md](CODE-REVIEW-943-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #942 | [SPEC-REVIEW-942-r1.md](SPEC-REVIEW-942-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | несуществующее поле «size visibility» у сводной панели | `docs/specs/505-summary-panel-design-parity.md` `AGENTS.md` `src/summary-panel-editor-style.ts` |
| #942 | [SPEC-REVIEW-942-r2.md](SPEC-REVIEW-942-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #942 | [CODE-REVIEW-942-r1.md](CODE-REVIEW-942-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #941 | [CODE-REVIEW-941-r1.md](CODE-REVIEW-941-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #940 | [SPEC-REVIEW-940-r1.md](SPEC-REVIEW-940-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #940 | [SPEC-REVIEW-940-r2.md](SPEC-REVIEW-940-r2.md) | spec · r2 | 🟡 жёлтый | 0 | 1 | · В СКОУПЕ · «случай A» не определён нигде в ТЗ — §5.1, абзац 3 | — |
| #940 | [SPEC-REVIEW-940-r3.md](SPEC-REVIEW-940-r3.md) | spec · r3 | 🟢 зелёный | 0 | 0 | — | — |
| #940 | [SPEC-REVIEW-940-r4.md](SPEC-REVIEW-940-r4.md) | spec · r4 | 🟢 зелёный | 0 | 0 | — | — |
| #940 | [CODE-REVIEW-940-r1.md](CODE-REVIEW-940-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #939 | [SPEC-REVIEW-939-r1.md](SPEC-REVIEW-939-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #939 | [CODE-REVIEW-939-r1.md](CODE-REVIEW-939-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #937 | [SPEC-REVIEW-937-r1.md](SPEC-REVIEW-937-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | T-узлы без названного теста | — |
| #937 | [SPEC-REVIEW-937-r2.md](SPEC-REVIEW-937-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #937 | [CODE-REVIEW-937-r1.md](CODE-REVIEW-937-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #936 | [SPEC-REVIEW-936-r1.md](SPEC-REVIEW-936-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #936 | [CODE-REVIEW-936-r1.md](CODE-REVIEW-936-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #935 | [SPEC-REVIEW-935-r1.md](SPEC-REVIEW-935-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #935 | [CODE-REVIEW-935-r1.md](CODE-REVIEW-935-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #931 | [SPEC-REVIEW-931-r1.md](SPEC-REVIEW-931-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #931 | [SPEC-REVIEW-931-r2.md](SPEC-REVIEW-931-r2.md) | spec · r2 | 🟡 жёлтый | 0 | 1 | не определена судьба существующего диалога «двойной клик → полные свойства» для объекто… | `docs/DECOR-EDITOR.md` `docs/UX-MODES.md` `src/houseplan-card.ts` |
| #931 | [SPEC-REVIEW-931-r3.md](SPEC-REVIEW-931-r3.md) | spec · r3 | 🟢 зелёный | 0 | 0 | — | — |
| #931 | [CODE-REVIEW-931-r1.md](CODE-REVIEW-931-r1.md) | code · r1 | 🟡 жёлтый | 0 | 0 | — | — |
| #931 | [CODE-REVIEW-931-r2.md](CODE-REVIEW-931-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #930 | [SPEC-REVIEW-930-r1.md](SPEC-REVIEW-930-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | решение о виртуальных устройствах не отражено в списке release-артефактов, docs/SCOPE.m… | `docs/SCOPE.md` `USER-GUIDE.ru.md` `USER-GUIDE.md` `FILTERING.md` `ARCHITECTURE.md` `DEVELOPMENT.md` `STATUS.md` `SCOPE.md` |
| #930 | [SPEC-REVIEW-930-r2.md](SPEC-REVIEW-930-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #930 | [CODE-REVIEW-930-r1.md](CODE-REVIEW-930-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #929 | [CODE-REVIEW-929-r1.md](CODE-REVIEW-929-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #928 | [SPEC-REVIEW-928-r1.md](SPEC-REVIEW-928-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #928 | [CODE-REVIEW-928-r1.md](CODE-REVIEW-928-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #927 | [CODE-REVIEW-927-r1.md](CODE-REVIEW-927-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #926 | [CODE-REVIEW-926-r1.md](CODE-REVIEW-926-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #925 | [CODE-REVIEW-925-r1.md](CODE-REVIEW-925-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #925 | [CODE-REVIEW-925-r2.md](CODE-REVIEW-925-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #924 | [CODE-REVIEW-924-r1.md](CODE-REVIEW-924-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #923 | [CODE-REVIEW-923-r1.md](CODE-REVIEW-923-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | edger и классификация | `docs/release-ledger/v1.81.0/923.json` `926.json` |
| #922 | [CODE-REVIEW-922-r1.md](CODE-REVIEW-922-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | несимметричный edge-case «ссылка перед номером строки» (принимается, не блокирует) | `PROCESS.md` |
| #922 | [CODE-REVIEW-922-r2.md](CODE-REVIEW-922-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #921 | [CODE-REVIEW-921-r1.md](CODE-REVIEW-921-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #920 | [SPEC-REVIEW-920-r1.md](SPEC-REVIEW-920-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #920 | [SPEC-REVIEW-920-r2.md](SPEC-REVIEW-920-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | риск-таблица §10 разорвана вставкой абзаца, строка «Host/input» теряет табличную разметку | — |
| #920 | [CODE-REVIEW-920-r1.md](CODE-REVIEW-920-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #920 | [CODE-REVIEW-920-r2.md](CODE-REVIEW-920-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #919 | [SPEC-REVIEW-919-r1.md](SPEC-REVIEW-919-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #919 | [CODE-REVIEW-919-r1.md](CODE-REVIEW-919-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #918 | [SPEC-REVIEW-918-r1.md](SPEC-REVIEW-918-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #918 | [CODE-REVIEW-918-r1.md](CODE-REVIEW-918-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #917 | [CODE-REVIEW-917-r1.md](CODE-REVIEW-917-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #866 | [SPEC-REVIEW-866-r1.md](SPEC-REVIEW-866-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 2 | пропорция core/shell в контракте п.4 не согласована с действующей; два новых i18n-ключа без описанной точки размещения | `src/styles/devices.styles.ts` `docs/DEVICE-PRESENTATION.md` |
| #866 | [SPEC-REVIEW-866-r2.md](SPEC-REVIEW-866-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #866 | [CODE-REVIEW-866-r1.md](CODE-REVIEW-866-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #638 | [CODE-REVIEW-638-r1.md](CODE-REVIEW-638-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
