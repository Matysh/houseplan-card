# ТЗ #42 — Измеряемое инженерное качество backend

- Issue: https://github.com/Matysh/houseplan-card/issues/42
- Приоритет: P2
- Статус ТЗ: ready for implementation by incremental gates
- Тип: infra/tests, без изменения успешных пользовательских сценариев

## Цель

Зафиксировать честное покрытие, строгую типизацию и стабильный error contract
backend integration без массового formatting rewrite.

## Coverage

- Добавить pinned `pytest-cov`; CI запускает Python 3.13 HA harness и pure tests
  одним coverage combine workflow.
- Baseline публикуется по каждому `custom_components/houseplan/*.py` с branch
  coverage. Первое включение не скрывает skipped HA tests.
- Gate вводится ступенями: не ниже baseline → 90% → минимум 95% executable
  lines и согласованный branch threshold. Generated/frontend bundle исключён.
- `coverage.xml` artifact и human summary; новые/изменённые строки требуют 100%
  либо documented pragma для unreachable defensive branch.

## Typing

Pyright/mypy strict включается per-module allowlist:

1. `validation.py`, `store.py`, auth/const;
2. websocket request/result boundaries;
3. repairs/diagnostics/system_health;
4. trails/runtime.

HA dynamic APIs изолируются typed Protocol/adapter, а не `Any` по всему модулю.
Allowlist только уменьшается.

## Lint/format

Ruff (или один выбранный tool) с narrow rule set: errors/imports/bugbear и
format-check только для новых/затронутых Python файлов. Отдельный mechanical
PR может нормализовать остальное; feature diff не содержит repo-wide rewrite.

## WebSocket error contract

Все user-facing failures имеют stable code enum, safe developer message и
optional structured details без персональных данных. Frontend mapping ru/en
не сравнивает английские message strings. Unknown code получает общий fallback.

## Quality Scale docs

Добавить troubleshooting, examples и проверить manifest/quality_scale claims.
Нельзя отмечать rule выполненным только наличием файла — acceptance следует HA
rule text и CI evidence.

## Приёмка

- CI нельзя пройти с silently skipped HA harness;
- coverage ≥95% executable lines после staged rollout;
- strict module allowlist и lint gates зелёные;
- WS tests проверяют code + frontend localization;
- docs examples исполняемы/проверяемы;
- изменения tooling не меняют stored data/runtime result.
