# Индекс ревью

Генерируется `node scripts/reviews-index.mjs` (#635) — не редактировать руками. Документов: 137, issue: 70. Вердикт: 🟢 зелёный · 🟡 жёлтый · 🔴 красный · ⚪ не распознан (свободная форма старых документов). H/M — число High/Medium по строке вердикта или заголовкам находок. Файлы — пути, названные в находках; ищите по имени файла: `grep form-kit INDEX.md`.

| Issue | Документ | Этап · раунд | Вердикт | H | M | Находки | Файлы |
|---|---|---|---|---:|---:|---|---|
| #912 | [SPEC-REVIEW-912-r1.md](SPEC-REVIEW-912-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #911 | [SPEC-REVIEW-911-r1.md](SPEC-REVIEW-911-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #910 | [SPEC-REVIEW-910-r1.md](SPEC-REVIEW-910-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #909 | [SPEC-REVIEW-909-r1.md](SPEC-REVIEW-909-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #908 | [SPEC-REVIEW-908-r1.md](SPEC-REVIEW-908-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #907 | [SPEC-REVIEW-907-r1.md](SPEC-REVIEW-907-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 2 | Release-артефакты: F017 отнесён к stable-fix, хотя introduced в текущей бета-линии; Release-артефакты: F005, вероятно, ошибочно исключён из stable-fix; «ленивые DE/FR» в разделе i18n не совсем точная формулировка (снято ревьюером); DoR: производительность и touch не названы явно отдельной строкой (снято ревьюером) | `hp-device-preview.ts` `houseplan-card.ts` `space-reference-repair.ts` `test/i18n-lazy-namespaces.test.mjs` `docs/TOUCH-SUPPORT.md` |
| #907 | [SPEC-REVIEW-907-r2.md](SPEC-REVIEW-907-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #906 | [SPEC-REVIEW-906-r1.md](SPEC-REVIEW-906-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #905 | [SPEC-REVIEW-905-r1.md](SPEC-REVIEW-905-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #904 | [SPEC-REVIEW-904-r1.md](SPEC-REVIEW-904-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | «комментарии ревьюера» в контракте можно прочитать как требование новой авторизации | `scripts/review-preflight.mjs` |
| #903 | [SPEC-REVIEW-903-r1.md](SPEC-REVIEW-903-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #902 | [SPEC-REVIEW-902-r1.md](SPEC-REVIEW-902-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 0 | DoR не закрыт: не названо влияние на touch/View-kiosk и на производительность | `PROCESS.md` `docs/TOUCH-SUPPORT.md` |
| #902 | [SPEC-REVIEW-902-r2.md](SPEC-REVIEW-902-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #901 | [SPEC-REVIEW-901-r1.md](SPEC-REVIEW-901-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #900 | [SPEC-REVIEW-900-r1.md](SPEC-REVIEW-900-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | отсутствует буквальная декларация Touch editor: … | `docs/TOUCH-SUPPORT.md` `docs/specs/485-radar-presence-stage1.md` `docs/specs/220-space-tab-reorder.md` |
| #899 | [CODE-REVIEW-899-r1.md](CODE-REVIEW-899-r1.md) | code · r1 | 🟡 жёлтый | 1 | 0 | новый LED-смок нестабилен: ~40% падений на собственном материале задачи | `demo/smoke_led_strip_glow.mjs` `docs/STATUS.md` `scripts/mutation-registry.mjs` |
| #899 | [CODE-REVIEW-899-r2.md](CODE-REVIEW-899-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #898 | [CODE-REVIEW-898-r1.md](CODE-REVIEW-898-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #897 | [SPEC-REVIEW-897-r1.md](SPEC-REVIEW-897-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | в «Release-артефакты» не назван явно пункт DoR «производительность/security» | `PROCESS.md` `REVIEWER.md` |
| #897 | [SPEC-REVIEW-897-r2.md](SPEC-REVIEW-897-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #897 | [CODE-REVIEW-897-r1.md](CODE-REVIEW-897-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #896 | [SPEC-REVIEW-896-r1.md](SPEC-REVIEW-896-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | пункт 5 контракта и AC5 не подтверждаются кодом | `scripts/bundle-budget.mjs` `test/bundle-assets.test.mjs` `bundle-budget.mjs` `bundle-assets.test.mjs` |
| #896 | [SPEC-REVIEW-896-r2.md](SPEC-REVIEW-896-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #896 | [CODE-REVIEW-896-r1.md](CODE-REVIEW-896-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #895 | [SPEC-REVIEW-895-r1.md](SPEC-REVIEW-895-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #895 | [CODE-REVIEW-895-r1.md](CODE-REVIEW-895-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #894 | [SPEC-REVIEW-894-r1.md](SPEC-REVIEW-894-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | отсутствует обязательный пункт DoR «влияние на производительность»; Файл: тело issue #894, раздел «Release-артефакты» | `docs/release-ledger/v1.80.1/878.json` `docs/DEVICE-PRESENTATION.md` `docs/release-ledger/v1.80.1/894.json` |
| #894 | [SPEC-REVIEW-894-r2.md](SPEC-REVIEW-894-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #894 | [CODE-REVIEW-894-r1.md](CODE-REVIEW-894-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #893 | [SPEC-REVIEW-893-r1.md](SPEC-REVIEW-893-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #893 | [CODE-REVIEW-893-r1.md](CODE-REVIEW-893-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #893 | [CODE-REVIEW-893-r2.md](CODE-REVIEW-893-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #892 | [SPEC-REVIEW-892-r1.md](SPEC-REVIEW-892-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | премиса «backend требует HA-admin» не подтверждается кодом; предлагаемое ужесточение не… | `custom_components/houseplan/auth.py` `custom_components/houseplan/websocket_api.py` `src/editors/general-settings-dialog.ts` `docs/SCOPE.md` `websocket_api.py` `general-settings-dialog.ts` |
| #892 | [SPEC-REVIEW-892-r2.md](SPEC-REVIEW-892-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #892 | [SPEC-REVIEW-892-r3.md](SPEC-REVIEW-892-r3.md) | spec · r3 | 🟢 зелёный | 0 | 0 | — | — |
| #892 | [CODE-REVIEW-892-r1.md](CODE-REVIEW-892-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #891 | [SPEC-REVIEW-891-r1.md](SPEC-REVIEW-891-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 2 | release-артефакты не называют обновление канона; классификация release-ledger не разделяет | `docs/UX-MODES.md` `docs/ARCHITECTURE.md` `docs/USER-GUIDE.md` `docs/DEVELOPMENT.md` `docs/STATUS.md` `src/wall-node-history.ts` `docs/process/REVIEWER.md` |
| #891 | [SPEC-REVIEW-891-r2.md](SPEC-REVIEW-891-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #891 | [CODE-REVIEW-891-r1.md](CODE-REVIEW-891-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #890 | [SPEC-REVIEW-890-r1.md](SPEC-REVIEW-890-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | пункт контракта 1 покрыт не полностью AC1; , снимаю сам — формулировка в «Принято предположительно» | `houseplan-card.ts` |
| #890 | [SPEC-REVIEW-890-r2.md](SPEC-REVIEW-890-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #890 | [CODE-REVIEW-890-r1.md](CODE-REVIEW-890-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #889 | [CODE-REVIEW-889-r1.md](CODE-REVIEW-889-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #889 | [CODE-REVIEW-889-r2.md](CODE-REVIEW-889-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #888 | [CODE-REVIEW-888-r1.md](CODE-REVIEW-888-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | тест сравнимости серии не ловит равномерно-грязный материал | `demo/helpers/node-performance-report.mjs` `test/node-performance-report.test.mjs` |
| #887 | [CODE-REVIEW-887-r1.md](CODE-REVIEW-887-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #885 | [SPEC-REVIEW-885-r1.md](SPEC-REVIEW-885-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | не назван канонический документ подсистемы среди release-артефактов | `docs/CANVAS.md` `AGENTS.md` `CANVAS.md` |
| #885 | [SPEC-REVIEW-885-r2.md](SPEC-REVIEW-885-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #885 | [CODE-REVIEW-885-r1.md](CODE-REVIEW-885-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #884 | [CODE-REVIEW-884-r1.md](CODE-REVIEW-884-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #883 | [SPEC-REVIEW-883-r1.md](SPEC-REVIEW-883-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #883 | [CODE-REVIEW-883-r1.md](CODE-REVIEW-883-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #883 | [CODE-REVIEW-883-r2.md](CODE-REVIEW-883-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #882 | [CODE-REVIEW-882-r1.md](CODE-REVIEW-882-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #881 | [CODE-REVIEW-881-r1.md](CODE-REVIEW-881-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #880 | [CODE-REVIEW-880-r1.md](CODE-REVIEW-880-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #880 | [CODE-REVIEW-880-r2.md](CODE-REVIEW-880-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #879 | [SPEC-REVIEW-879-r1.md](SPEC-REVIEW-879-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #879 | [CODE-REVIEW-879-r1.md](CODE-REVIEW-879-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #878 | [CODE-REVIEW-878-r1.md](CODE-REVIEW-878-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #878 | [CODE-REVIEW-878-r2.md](CODE-REVIEW-878-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #878 | [CODE-REVIEW-878-r3.md](CODE-REVIEW-878-r3.md) | code · r3 | 🟢 зелёный | 0 | 0 | — | — |
| #877 | [CODE-REVIEW-877-r1.md](CODE-REVIEW-877-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #877 | [CODE-REVIEW-877-r2.md](CODE-REVIEW-877-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #876 | [SPEC-REVIEW-876-r1.md](SPEC-REVIEW-876-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | M1 | `src/editors/space-form.ts` |
| #876 | [SPEC-REVIEW-876-r2.md](SPEC-REVIEW-876-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #876 | [CODE-REVIEW-876-r1.md](CODE-REVIEW-876-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #875 | [SPEC-REVIEW-875-r1.md](SPEC-REVIEW-875-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #875 | [CODE-REVIEW-875-r1.md](CODE-REVIEW-875-r1.md) | code · r1 | 🟡 жёлтый | 0 | 1 | новый guard в openSpaceDialog ломает «Add space» на непустом плане, пока открыт обычный… | `src/houseplan-card.ts` `houseplan-card.ts` |
| #875 | [CODE-REVIEW-875-r2.md](CODE-REVIEW-875-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #875 | [CODE-REVIEW-875-r3.md](CODE-REVIEW-875-r3.md) | code · r3 | 🟢 зелёный | 0 | 0 | — | — |
| #874 | [SPEC-REVIEW-874-r1.md](SPEC-REVIEW-874-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #874 | [CODE-REVIEW-874-r1.md](CODE-REVIEW-874-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #873 | [SPEC-REVIEW-873-r1.md](SPEC-REVIEW-873-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #873 | [CODE-REVIEW-873-r1.md](CODE-REVIEW-873-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #872 | [SPEC-REVIEW-872-r1.md](SPEC-REVIEW-872-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | неверный номер строки у источника формата Dreame path | `docs/VACUUM.md` |
| #872 | [CODE-REVIEW-872-r1.md](CODE-REVIEW-872-r1.md) | code · r1 | 🟡 жёлтый | 0 | 1 | §8.4 budget degradation не достаёт до заявленного поведения | `src/vacuum-path-geometry.ts` `test/vacuum-path-geometry.test.mjs` `houseplan-card.ts` `vacuum-path-geometry.ts` |
| #872 | [CODE-REVIEW-872-r2.md](CODE-REVIEW-872-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #871 | [SPEC-REVIEW-871-r1.md](SPEC-REVIEW-871-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #871 | [CODE-REVIEW-871-r1.md](CODE-REVIEW-871-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #869 | [SPEC-REVIEW-869-r1.md](SPEC-REVIEW-869-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #869 | [CODE-REVIEW-869-r1.md](CODE-REVIEW-869-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #868 | [CODE-REVIEW-868-r1.md](CODE-REVIEW-868-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #867 | [SPEC-REVIEW-867-r1.md](SPEC-REVIEW-867-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #867 | [CODE-REVIEW-867-r1.md](CODE-REVIEW-867-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #864 | [SPEC-REVIEW-864-r1.md](SPEC-REVIEW-864-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #864 | [SPEC-REVIEW-864-r2.md](SPEC-REVIEW-864-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #864 | [SPEC-REVIEW-864-r3.md](SPEC-REVIEW-864-r3.md) | spec · r3 | 🟢 зелёный | 0 | 0 | — | — |
| #864 | [CODE-REVIEW-864-r1.md](CODE-REVIEW-864-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #863 | [CODE-REVIEW-863-r1.md](CODE-REVIEW-863-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #861 | [SPEC-REVIEW-861-r1.md](SPEC-REVIEW-861-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #861 | [SPEC-REVIEW-861-r2.md](SPEC-REVIEW-861-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #861 | [CODE-REVIEW-861-r1.md](CODE-REVIEW-861-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #860 | [CODE-REVIEW-860-r1.md](CODE-REVIEW-860-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #858 | [CODE-REVIEW-858-r1.md](CODE-REVIEW-858-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #857 | [CODE-REVIEW-857-r1.md](CODE-REVIEW-857-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #856 | [CODE-REVIEW-856-r1.md](CODE-REVIEW-856-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #855 | [CODE-REVIEW-855-r1.md](CODE-REVIEW-855-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #854 | [CODE-REVIEW-854-r1.md](CODE-REVIEW-854-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #851 | [SPEC-REVIEW-851-r1.md](SPEC-REVIEW-851-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #851 | [CODE-REVIEW-851-r1.md](CODE-REVIEW-851-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #850 | [SPEC-REVIEW-850-r1.md](SPEC-REVIEW-850-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | AC4(а) не называет способ доказательства для заявки «0 пересчётов … на камере» | `test/glow-scene.test.mjs` `test/devices.test.mjs` `demo/benchmark_led_strips.mjs` `demo/benchmark_large_house.mjs` `demo/performance/budgets-led-strips.json` `benchmark_large_house.mjs` |
| #850 | [SPEC-REVIEW-850-r2.md](SPEC-REVIEW-850-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #850 | [CODE-REVIEW-850-r1.md](CODE-REVIEW-850-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #849 | [SPEC-REVIEW-849-r1.md](SPEC-REVIEW-849-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #849 | [CODE-REVIEW-849-r1.md](CODE-REVIEW-849-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #848 | [SPEC-REVIEW-848-r1.md](SPEC-REVIEW-848-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #848 | [CODE-REVIEW-848-r1.md](CODE-REVIEW-848-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | неиспользуемый публичный класс после рефакторинга (не блокирует) | `src/summary-runtime-loader.ts` `houseplan-card.ts` `src/houseplan-card.ts` `test/summary-runtime-loader.test.mjs` |
| #847 | [SPEC-REVIEW-847-r1.md](SPEC-REVIEW-847-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 2 | контракт обещает pagehide, но ни один AC, ни план автотестов, ни «Файлы и модули» не на…; согласованные по делу F84/F86 не привязаны ни к одному AC и не имеют названного способа… | `houseplan-card.ts` `src/visual-continuity.ts` `wall-node-editor.ts` `visual-continuity.ts` `demo/smoke_view_hold_lifecycle.mjs` |
| #847 | [SPEC-REVIEW-847-r2.md](SPEC-REVIEW-847-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #847 | [CODE-REVIEW-847-r1.md](CODE-REVIEW-847-r1.md) | code · r1 | 🟡 жёлтый | 0 | 1 | AC4(в)/D6: «_commitSpace не завершает удержание» не доказано ни мутантом, ни изолирующи… | `scripts/mutation-registry.mjs` `src/houseplan-card.ts` `demo/smoke_view_hold_lifecycle.mjs` |
| #847 | [CODE-REVIEW-847-r2.md](CODE-REVIEW-847-r2.md) | code · r2 | 🟡 жёлтый | 0 | 0 | — | — |
| #847 | [CODE-REVIEW-847-r3.md](CODE-REVIEW-847-r3.md) | code · r3 | 🟢 зелёный | 0 | 0 | — | — |
| #846 | [SPEC-REVIEW-846-r1.md](SPEC-REVIEW-846-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #846 | [CODE-REVIEW-846-r1.md](CODE-REVIEW-846-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #845 | [SPEC-REVIEW-845-r1.md](SPEC-REVIEW-845-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | защитная регрессия AC4/AC8 не привязана к | `845-wall-identity-parity.json` `tests_backend/wall_node_parity.py` `scripts/mutation-registry.mjs` `demo/srv/demo.html` `test/model-invariants.test.mjs` `fixture-wall-key.test.mjs` `wall-segment-model.ts` `model-invariants.test.mjs` |
| #845 | [SPEC-REVIEW-845-r2.md](SPEC-REVIEW-845-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #845 | [CODE-REVIEW-845-r1.md](CODE-REVIEW-845-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #844 | [SPEC-REVIEW-844-r1.md](SPEC-REVIEW-844-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #844 | [CODE-REVIEW-844-r1.md](CODE-REVIEW-844-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #843 | [SPEC-REVIEW-843-r1.md](SPEC-REVIEW-843-r1.md) | spec · r1 | 🟢 зелёный | 0 | 1 | вне скоупа (заведён отдельный issue); снимаю сам, не блокирует | `houseplan-editor-runtime.ts` `houseplan-card.ts` |
| #843 | [CODE-REVIEW-843-r1.md](CODE-REVIEW-843-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #843 | [CODE-REVIEW-843-r2.md](CODE-REVIEW-843-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #842 | [SPEC-REVIEW-842-r1.md](SPEC-REVIEW-842-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | AC не покрывают заявленный «обычный» путь записи | `houseplan-card.ts` `houseplan-editor-runtime.ts` |
| #842 | [SPEC-REVIEW-842-r2.md](SPEC-REVIEW-842-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #842 | [CODE-REVIEW-842-r1.md](CODE-REVIEW-842-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #841 | [CODE-REVIEW-841-r1.md](CODE-REVIEW-841-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | edger | `docs/release-ledger/v1.80.1/841.json` `scripts/release-ledger.mjs` |
| #840 | [CODE-REVIEW-840-r1.md](CODE-REVIEW-840-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #839 | [CODE-REVIEW-839-r1.md](CODE-REVIEW-839-r1.md) | code · r1 | 🟡 жёлтый | 0 | 1 | в docs/release-ledger/v1.80.1/839.json протащена часть | `docs/release-ledger/v1.80.1/839.json` `839.json` `docs/DEVELOPMENT.md` `PROCESS.md` |
| #839 | [CODE-REVIEW-839-r2.md](CODE-REVIEW-839-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #838 | [CODE-REVIEW-838-r1.md](CODE-REVIEW-838-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #837 | [CODE-REVIEW-837-r1.md](CODE-REVIEW-837-r1.md) | code · r1 | 🔴 красный | 1 | 0 | коммит f7520800 дублирует уже выделенный под эту же поломку issue #839 | `scripts/md-anchors.mjs` `scripts/reviews-index.mjs` `reviews-archive.mjs` `docs/release-ledger/v1.80.1/839.json` `docs/DEVELOPMENT.md` `docs/STATUS.md` `scripts/reviews-archive.mjs` |
| #837 | [CODE-REVIEW-837-r2.md](CODE-REVIEW-837-r2.md) | code · r2 | 🔴 красный | 1 | 0 | отсутствует обязательная классификация релиза docs/release-ledger/v1.80.1/837.json | `docs/release-ledger/v1.80.1/837.json` `docs/release-ledger/cycle.json` `638.json` `674.json` `838.json` `839.json` `837.json` `scripts/merge-candidate.mjs` |
| #837 | [CODE-REVIEW-837-r3.md](CODE-REVIEW-837-r3.md) | code · r3 | 🟢 зелёный | 0 | 0 | — | — |
| #836 | [SPEC-REVIEW-836-r1.md](SPEC-REVIEW-836-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #836 | [CODE-REVIEW-836-r1.md](CODE-REVIEW-836-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #638 | [CODE-REVIEW-638-r1.md](CODE-REVIEW-638-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
