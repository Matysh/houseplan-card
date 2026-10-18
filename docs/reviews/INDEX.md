# Индекс ревью

Генерируется `node scripts/reviews-index.mjs` (#635) — не редактировать руками. Документов: 59, issue: 32. Вердикт: 🟢 зелёный · 🟡 жёлтый · 🔴 красный · ⚪ не распознан (свободная форма старых документов). H/M — число High/Medium по строке вердикта или заголовкам находок. Файлы — пути, названные в находках; ищите по имени файла: `grep form-kit INDEX.md`.

| Issue | Документ | Этап · раунд | Вердикт | H | M | Находки | Файлы |
|---|---|---|---|---:|---:|---|---|
| #954 | [CODE-REVIEW-954-r1.md](CODE-REVIEW-954-r1.md) | code · r1 | 🟡 жёлтый | 0 | 0 | — | — |
| #952 | [CODE-REVIEW-952-r1.md](CODE-REVIEW-952-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #951 | [CODE-REVIEW-951-r1.md](CODE-REVIEW-951-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #950 | [CODE-REVIEW-950-r1.md](CODE-REVIEW-950-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #949 | [CODE-REVIEW-949-r1.md](CODE-REVIEW-949-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #949 | [CODE-REVIEW-949-r2.md](CODE-REVIEW-949-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #948 | [SPEC-REVIEW-948-r1.md](SPEC-REVIEW-948-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #947 | [SPEC-REVIEW-947-r1.md](SPEC-REVIEW-947-r1.md) | spec · r1 | 🔴 красный | 1 | 1 | AC5 и раздел «Модель данных» молча убирают единственный способ завести НОВЫЙ радар пяти…; раздел «Модель данных» предписывает добавить | `src/houseplan-editor-runtime.ts` `src/editors/radar-section.ts` `docs/RADAR.md` `docs/SCOPE.md` `src/radar-editor.ts` `docs/CONFIG-COMPATIBILITY.md` `src/types.ts` `src/device-signal.ts` |
| #947 | [SPEC-REVIEW-947-r2.md](SPEC-REVIEW-947-r2.md) | spec · r2 | 🟡 жёлтый | 0 | 1 | новый пункт раздела «Модель данных» подтверждает удаление единственного пути настройки …; абзац «Модель данных и совместимость» не отредактирован и дословно противоречит более п… | `AGENTS.md` `docs/RADAR.md` `docs/USER-GUIDE.ru.md` `src/editors/marker-dialog.ts` `hp-device-preview.ts` |
| #947 | [SPEC-REVIEW-947-r3.md](SPEC-REVIEW-947-r3.md) | spec · r3 | 🟡 жёлтый | 0 | 1 | новый раздел «Документация» сужает объём правки docs/RADAR.md до одного подраздела, но … | `docs/RADAR.md` `docs/USER-GUIDE.ru.md` |
| #947 | [SPEC-REVIEW-947-r4.md](SPEC-REVIEW-947-r4.md) | spec · r4 | 🟢 зелёный | 0 | 0 | — | — |
| #946 | [SPEC-REVIEW-946-r1.md](SPEC-REVIEW-946-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | «связанный переход» Room → Space входит в AC5, но не | `room-settings-v4.html` `.fragment.html` `.data.json` `README.md` `draft-decisions.md` `docs/USER-GUIDE.ru.md` |
| #946 | [SPEC-REVIEW-946-r2.md](SPEC-REVIEW-946-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #945 | [SPEC-REVIEW-945-r1.md](SPEC-REVIEW-945-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | «Затронутые модули»/модель данных не называют три | `custom_components/houseplan/import_export.py` `custom_components/houseplan/support_package.py` `custom_components/houseplan/support_wire_schema.py` `tests_backend/test_support_package.py` `docs/SCOPE.md` `validation.py` `docs/reviews/SPEC-REVIEW-943-r1.md` `support_package.py` |
| #945 | [SPEC-REVIEW-945-r2.md](SPEC-REVIEW-945-r2.md) | spec · r2 | 🟡 жёлтый | 0 | 1 | новое/переименованное поле локального режима заряда устройств пространства нигде не наз… | — |
| #945 | [SPEC-REVIEW-945-r3.md](SPEC-REVIEW-945-r3.md) | spec · r3 | 🟢 зелёный | 0 | 0 | — | — |
| #943 | [SPEC-REVIEW-943-r1.md](SPEC-REVIEW-943-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | «Затронутые модули» не называют parity-контракт | `validation.py` `custom_components/houseplan/support_package.py` `custom_components/houseplan/support_wire_schema.py` `docs/SUPPORT-PRIVACY.md` `tests_backend/test_support_package.py` `src/logic.ts` `logic.ts` `support_package.py` |
| #943 | [SPEC-REVIEW-943-r2.md](SPEC-REVIEW-943-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #943 | [CODE-REVIEW-943-r1.md](CODE-REVIEW-943-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #942 | [SPEC-REVIEW-942-r1.md](SPEC-REVIEW-942-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | несуществующее поле «size visibility» у сводной панели | `docs/specs/505-summary-panel-design-parity.md` `AGENTS.md` `src/summary-panel-editor-style.ts` |
| #942 | [SPEC-REVIEW-942-r2.md](SPEC-REVIEW-942-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #942 | [CODE-REVIEW-942-r1.md](CODE-REVIEW-942-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #941 | [CODE-REVIEW-941-r1.md](CODE-REVIEW-941-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #937 | [SPEC-REVIEW-937-r1.md](SPEC-REVIEW-937-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | T-узлы без названного теста | — |
| #937 | [SPEC-REVIEW-937-r2.md](SPEC-REVIEW-937-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #937 | [CODE-REVIEW-937-r1.md](CODE-REVIEW-937-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #936 | [SPEC-REVIEW-936-r1.md](SPEC-REVIEW-936-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #936 | [CODE-REVIEW-936-r1.md](CODE-REVIEW-936-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #935 | [SPEC-REVIEW-935-r1.md](SPEC-REVIEW-935-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #935 | [CODE-REVIEW-935-r1.md](CODE-REVIEW-935-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #931 | [SPEC-REVIEW-931-r1.md](SPEC-REVIEW-931-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
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
