# Исторический индекс ревью

Снимок прежних ревью: 22 документа по восьми issue и линии v1.83.1.
Индекс помогает найти замечания по конкретной задаче или файлу; читать весь
архив при входе в проект не требуется.

Таблица сохранена как историческая справка. Старые требования к процессу
в этих документах не являются текущими инструкциями; правила находятся
в корневом [PROCESS.md](../../PROCESS.md). Новая обвязка #1105 пока не подключена.

Вердикт: 🟢 зелёный · 🟡 жёлтый · 🔴 красный · ⚪ не распознан.
H/M — число High/Medium по строке вердикта или заголовкам находок.
Файлы — пути, названные в находках.

| Issue | Документ | Этап · раунд | Вердикт | H | M | Находки | Файлы |
|---|---|---|---|---:|---:|---|---|
| линия v1.83.1 | [RELEASE-REVIEW-v1.83.1.md](RELEASE-REVIEW-v1.83.1.md) | ревью линии · — | ⚪ — | 0 | 0 | приватный backend-хелпер пересекает границу модуля без публичного контракта | `custom_components/houseplan/partition_promotion.py` `src/wall-incidence.ts` `src/stored-wall-contact.ts` `junction_limits.py` `partition_promotion.py` `wall_incidence.py` `wall-incidence.ts` |
| #1171 | [SPEC-REVIEW-1171-r1.md](SPEC-REVIEW-1171-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1171 | [SPEC-REVIEW-1171-r2.md](SPEC-REVIEW-1171-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #1171 | [CODE-REVIEW-1171-r1.md](CODE-REVIEW-1171-r1.md) | code · r1 | 🟡 жёлтый | 0 | 1 | face/side для не-gate проёмов ошибочно использует индексированную грань, когда индекс п… | `src/space-render.ts` `houseplan-card.ts` `demo/fixtures/static-wall-openings.mjs` `test/static-wall-openings.test.mjs` `demo/smoke_static_wall_openings.mjs` `src/houseplan-card.ts` `src/wall-thickness.ts` `docs/development-notes/static-wall-openings-1171.md` |
| #1171 | [CODE-REVIEW-1171-r2.md](CODE-REVIEW-1171-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #1166 | [SPEC-REVIEW-1166-r1.md](SPEC-REVIEW-1166-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | не назван перформанс-эффект (DoR §2.5 / §8) | — |
| #1166 | [SPEC-REVIEW-1166-r2.md](SPEC-REVIEW-1166-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #1166 | [SPEC-REVIEW-1166-r3.md](SPEC-REVIEW-1166-r3.md) | spec · r3 | 🟢 зелёный | 0 | 0 | — | — |
| #1166 | [CODE-REVIEW-1166-r1.md](CODE-REVIEW-1166-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1164 | [CODE-REVIEW-1164-r1.md](CODE-REVIEW-1164-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1150 | [SPEC-REVIEW-1150-r1.md](SPEC-REVIEW-1150-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | — | — |
| #1150 | [SPEC-REVIEW-1150-r2.md](SPEC-REVIEW-1150-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #1150 | [CODE-REVIEW-1150-r1.md](CODE-REVIEW-1150-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1149 | [SPEC-REVIEW-1149-r1.md](SPEC-REVIEW-1149-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1149 | [CODE-REVIEW-1149-r1.md](CODE-REVIEW-1149-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1148 | [SPEC-REVIEW-1148-r1.md](SPEC-REVIEW-1148-r1.md) | spec · r1 | 🟡 жёлтый | 0 | 1 | — | — |
| #1148 | [SPEC-REVIEW-1148-r2.md](SPEC-REVIEW-1148-r2.md) | spec · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #1148 | [CODE-REVIEW-1148-r1.md](CODE-REVIEW-1148-r1.md) | code · r1 | 🟡 жёлтый | 0 | 1 | — | — |
| #1148 | [CODE-REVIEW-1148-r2.md](CODE-REVIEW-1148-r2.md) | code · r2 | 🟢 зелёный | 0 | 0 | — | — |
| #1147 | [SPEC-REVIEW-1147-r1.md](SPEC-REVIEW-1147-r1.md) | spec · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1147 | [CODE-REVIEW-1147-r1.md](CODE-REVIEW-1147-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
| #1146 | [CODE-REVIEW-1146-r1.md](CODE-REVIEW-1146-r1.md) | code · r1 | 🟢 зелёный | 0 | 0 | — | — |
