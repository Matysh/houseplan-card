# Индекс ревью

Генерируется `node scripts/reviews-index.mjs` (#635) — не редактировать руками. Документов: 33, issue: 19. Вердикт: 🟢 зелёный · 🟡 жёлтый · 🔴 красный · ⚪ не распознан (свободная форма старых документов). H/M — число High/Medium по строке вердикта или заголовкам находок. Файлы — пути, названные в находках; ищите по имени файла: `grep form-kit INDEX.md`.

| Issue | Документ | Этап · раунд | Вердикт | H | M | Находки | Файлы |
|---|---|---|---|---:|---:|---|---|
| #1037 | [SPEC-REVIEW-1037-r1.md](SPEC-REVIEW-1037-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | не называет затронутый DOM/test-identity контракт docs/STYLING-HOOKS.md | `docs/STYLING-HOOKS.md` `demo/smoke_e2e_hooks.mjs` `docs/reviews/CODE-REVIEW-1011-r3.md` `space-form.ts` `general-settings-dialog.ts` `room-settings-dialog.ts` `STYLING-HOOKS.md` `AGENTS.md` |
| #1032 | [CODE-REVIEW-1032-r1.md](CODE-REVIEW-1032-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1031 | [SPEC-REVIEW-1031-r1.md](SPEC-REVIEW-1031-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1031 | [CODE-REVIEW-1031-r1.md](CODE-REVIEW-1031-r1.md) | code · r1 | 🔴 красный | 1 | 0 | новый целевой smoke не проходит на материале ревью; заявленные «43 PASS» не воспроизвод… | `demo/smoke_zigbee_enable_refresh.mjs` `demo/smoke_zigbee_topology_job.mjs` `zigbee-topology-action.ts` `scripts/ci-registry-inventory.json` |
| #1031 | [CODE-REVIEW-1031-r2.md](CODE-REVIEW-1031-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #1030 | [CODE-REVIEW-1030-r1.md](CODE-REVIEW-1030-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1029 | [SPEC-REVIEW-1029-r1.md](SPEC-REVIEW-1029-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1028 | [CODE-REVIEW-1028-r1.md](CODE-REVIEW-1028-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1021 | [CODE-REVIEW-1021-r1.md](CODE-REVIEW-1021-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1016 | [CODE-REVIEW-1016-r1.md](CODE-REVIEW-1016-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | устаревшая формулировка в docs/TESTING.md:385 | `docs/TESTING.md` `bundle-sync.mjs` `AGENTS.md` `PROCESS.md` `docs/ARCHITECTURE.md` `docs/DEVELOPMENT.md` `docs/STATUS.md` `docs/process/AUTHOR.md` |
| #1016 | [CODE-REVIEW-1016-r2.md](CODE-REVIEW-1016-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #1013 | [CODE-REVIEW-1013-r1.md](CODE-REVIEW-1013-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1013 | [CODE-REVIEW-1013-r2.md](CODE-REVIEW-1013-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #1012 | [CODE-REVIEW-1012-r1.md](CODE-REVIEW-1012-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1011 | [SPEC-REVIEW-1011-r1.md](SPEC-REVIEW-1011-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | две строки контрактной таблицы не называют все свои атрибуты в заголовке | `docs/data-hp-contract.json` `docs/process/REVIEWER.md` |
| #1011 | [CODE-REVIEW-1011-r2.md](CODE-REVIEW-1011-r2.md) | code · r2 | 🟡 жёлтый | 0 | 0 | — | — |
| #1011 | [CODE-REVIEW-1011-r3.md](CODE-REVIEW-1011-r3.md) | code · r3 | 🟡 жёлтый | 0 | 1 | блокирует зелёный вердикт | `src/houseplan-editor-runtime.ts` `docs/data-hp-contract.json` `docs/STYLING-HOOKS.md` `hp-color-opacity.ts` `form-kit.ts` `decor-image-editor.ts` `scripts/data-hp-source.mjs` `test/data-hp-contract.test.mjs` |
| #1011 | [CODE-REVIEW-1011-r4.md](CODE-REVIEW-1011-r4.md) | code · r4 | 🟢 зелёный | 0 | 0 | — | — |
| #1009 | [CODE-REVIEW-1009-r1.md](CODE-REVIEW-1009-r1.md) | code · r1 | 🟡 жёлтый | 0 | 1 | npm test красный из-за этого диффа | `docs/TESTING.md` `test/testing-doc.test.mjs` `scripts/smoke-select.mjs` |
| #1009 | [CODE-REVIEW-1009-r2.md](CODE-REVIEW-1009-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #1008 | [SPEC-REVIEW-1008-r1.md](SPEC-REVIEW-1008-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | «четырёх диалогов» в AC3 не совпадает с пятью названными потребителями | `houseplan-card.ts` `hp-color-opacity.ts` `smoke_stairs.mjs` `docs/process/REVIEWER.md` |
| #1008 | [CODE-REVIEW-1008-r1.md](CODE-REVIEW-1008-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1007 | [SPEC-REVIEW-1007-r1.md](SPEC-REVIEW-1007-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | «Файлы и реализация» не называет реальные источники дублирования для заявленных охватом… | `src/houseplan-editor-runtime.ts` `src/styles/settings-dialogs.styles.ts` `src/styles/editor-dialogs.styles.ts` `src/editor-style-adoption.ts` `src/editors/settings-styles.ts` `houseplan-editor-runtime.ts` `editor-dialogs.styles.ts` |
| #1007 | [SPEC-REVIEW-1007-r2.md](SPEC-REVIEW-1007-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #1007 | [CODE-REVIEW-1007-r1.md](CODE-REVIEW-1007-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1006 | [SPEC-REVIEW-1006-r1.md](SPEC-REVIEW-1006-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1006 | [CODE-REVIEW-1006-r1.md](CODE-REVIEW-1006-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1005 | [SPEC-REVIEW-1005-r1.md](SPEC-REVIEW-1005-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1005 | [CODE-REVIEW-1005-r1.md](CODE-REVIEW-1005-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1002 | [SPEC-REVIEW-1002-r1.md](SPEC-REVIEW-1002-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1002 | [CODE-REVIEW-1002-r1.md](CODE-REVIEW-1002-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #987 | [CODE-REVIEW-987-r1.md](CODE-REVIEW-987-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #638 | [CODE-REVIEW-638-r1.md](CODE-REVIEW-638-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
