# Issue #281 — честный Resize после outer-partition reconciliation

- Дата: 2026-08-24
- Тип: regression bug · приоритет P1
- Issue: [#281](https://github.com/Matysh/houseplan-card/issues/281)
- Ветка: `issue/281-resize-zero-range`
- Статус ТЗ: одобрено self-review по решению владельца

Связанные контракты: #276, #277, #278, #280;
`docs/RESIZE.md`, `docs/WALL-THICKNESS.md`, `docs/TESTING.md`.

## 1. Проблема

Eligibility beta.8 проверяет только исходный `d=0`, поэтому handle выглядит
активным, хотя обе соседние grid-позиции блокируются endpoint-touching
partitions и `clampSafeResize()` всегда возвращает ноль.

Resize не должен скрыто двигать или игнорировать independent walls. Перед ним
явный Optimize обязан канонизировать только доказанно лишние тела; всё
неоднозначное остаётся препятствием.

## 2. Уточнение принятого default после self-review

В аналитическом комментарии Q1 ошибочно утверждалось, что две outer partitions
целевого `44.json` не имеют openings. Фактически каждая содержит hosted window.
Буквальный вариант «только без openings» не исправляет заявленный сценарий.

Минимальная системная поправка в пользу принятого пользовательского результата:
exact outer duplicate допускается и с hosted openings, только если все они
полностью и без конфликтов материализуются как ordinary outer-room openings по
тем же identity/geometry/envelope доказательствам #276/#280. Backend требует
solid boundary одного либо двух rooms. Ordinary conflicting opening,
неразрешимый host или overlap блокирует весь candidate. Resize по-прежнему не
двигает и не игнорирует partition.

## 3. Optimize-контракт

Один reconciliation pass рассматривает solid atomic interval:

- `shared`: ровно два owner rooms, действующий #276 contract;
- `outer`: ровно один owner room;
- partition exact endpoint-to-endpoint, known fields only, centred envelope;
- нет overlapping second partition, draft или column;
- итоговая толщина `max(roomCm, partitionCm)`;
- every hosted opening полностью покрывается room interval, materializes без
  потери полей и не пересекает другие openings;
- после rehost ordinary association имеет ровно тот же набор owner rooms.

Partial/composite/virtual/ambiguous/unknown/conflicting случаи byte-equivalent.
Apply/reload/repeated Optimize идемпотентны; Undo возвращает partition и hosts.

## 4. Resize-контракт

`SafeResizeOptions` содержит реальный grid step. После построения plan resolver
обязан проверить `-step` и `+step` тем же `validateSafeResize`, который
используют preview/commit.

- хотя бы один valid соседний node → handle enabled;
- оба invalid → handle disabled, pointer не захватывается;
- если соседний candidate блокирует immutable physical obstacle, причина
  `duplicate-physical-wall`; иначе существующий deterministic reason либо
  `invalid-geometry`;
- формулировка #277 «enabled + zero-only range» отменяется.

Clamp остаётся contiguous и не перепрыгивает препятствие.

## 5. Acceptance criteria

1. Privacy-min fixture с двумя rooms, целевой shared wall, тремя exact outer
   partitions и hosted windows воспроизводит старый zero range.
2. Optimize удаляет только exact duplicates, materializes windows, сохраняет
   envelope; backend принимает candidate и повторный Optimize no-op.
3. После Optimize целевой handle допускает минимум один шаг в обе стороны;
   fixed topology, две rooms, thickness/openings и segment count сохраняются.
4. До Optimize zero-range handle disabled с `duplicate-physical-wall`, не
   захватывает pointer и не пишет config/history.
5. Partial/longer/unknown/opening-conflict/second partition/draft/column
   остаются; их handle не становится ложноположительным.
6. Полный `C:\Temp\44.json`: Optimize candidate проходит frontend/backend,
   целевая shared wall имеет ненулевой диапазон; inventory не содержит enabled
   handle без соседнего valid grid node.
7. Typecheck, unit, build, Optimize/Resize production smokes зелёные; Linux HA
   test подтверждает outer rehost Apply/reload/Undo.

## 6. Совместимость, UX и performance

Schema/model version не меняются. Stored result — существующие room wall и
ordinary opening. Disabled handle уже использует доступный focus/tap reason и
не требует нового UI/i18n. Дополнительные две validations выполняются один раз
в memoized eligibility, не на каждом pointermove; Optimize pass остаётся
явным, линейным по atomic intervals и candidates.

## 7. Self-review ТЗ

- Обнаруженное противоречие с приватным input не замаскировано: hosted windows
  включены только через доказанный rehost, а не через Resize bypass.
- Одна validation функция определяет eligibility, live clamp и commit.
- Negative matrix сохраняет partitions как hard stops, когда proof неполон.
- Exact lifecycle проверяет обе стороны границы: Optimize canonicalization и
  честную Resize affordance.

Вердикт: **approved** с описанным минимальным уточнением Q1. Внешнее
spec-review пропущено по прямому решению владельца.

