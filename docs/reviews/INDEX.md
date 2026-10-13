# Индекс ревью

Генерируется `node scripts/reviews-index.mjs` (#635) — не редактировать руками. Документов: 27, issue: 17. Вердикт: 🟢 зелёный · 🟡 жёлтый · 🔴 красный · ⚪ не распознан (свободная форма старых документов). H/M — число High/Medium по строке вердикта или заголовкам находок. Файлы — пути, названные в находках; ищите по имени файла: `grep form-kit INDEX.md`.

| Issue | Документ | Этап · раунд | Вердикт | H | M | Находки | Файлы |
|---|---|---|---|---:|---:|---|---|
| бета v1.80.0-beta.7 | [SHIP-REVIEW-v1.80.0-beta.7.md](SHIP-REVIEW-v1.80.0-beta.7.md) | пакетное ревью ship · — | 🟢 зелёный | 0 | 0 | — | — |
| бета v1.80.0-beta.1 | [SHIP-REVIEW-v1.80.0-beta.1.md](SHIP-REVIEW-v1.80.0-beta.1.md) | пакетное ревью ship · — | 🟢 зелёный | 0 | 0 | — | — |
| #868 | [CODE-REVIEW-868-r1.md](CODE-REVIEW-868-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #864 | [SPEC-REVIEW-864-r1.md](SPEC-REVIEW-864-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #864 | [SPEC-REVIEW-864-r2.md](SPEC-REVIEW-864-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #864 | [SPEC-REVIEW-864-r3.md](SPEC-REVIEW-864-r3.md) | spec · r3 | 🟢 зелёный | 0 | 0 | — | — |
| #864 | [CODE-REVIEW-864-r1.md](CODE-REVIEW-864-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #863 | [CODE-REVIEW-863-r1.md](CODE-REVIEW-863-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #860 | [CODE-REVIEW-860-r1.md](CODE-REVIEW-860-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #858 | [CODE-REVIEW-858-r1.md](CODE-REVIEW-858-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #857 | [CODE-REVIEW-857-r1.md](CODE-REVIEW-857-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #856 | [CODE-REVIEW-856-r1.md](CODE-REVIEW-856-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #855 | [CODE-REVIEW-855-r1.md](CODE-REVIEW-855-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #854 | [CODE-REVIEW-854-r1.md](CODE-REVIEW-854-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #842 | [SPEC-REVIEW-842-r1.md](SPEC-REVIEW-842-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | AC не покрывают заявленный «обычный» путь записи | `houseplan-card.ts` `houseplan-editor-runtime.ts` |
| #842 | [SPEC-REVIEW-842-r2.md](SPEC-REVIEW-842-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
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
