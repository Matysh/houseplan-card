"""#446: golden-документы конвертера Sweet Home 3D против настоящей схемы.

Вторая половина цепочки против дрейфа версий. Конвертер живёт в репозитории и
раздаётся страницей `/convert` на сайте; между сайтом и моделью плана нет
ничего, кроме этого гейта. Поэтому golden проверяются не «структурой», а тем
самым `CONFIG_SCHEMA` и тем самым `commit_wall_segment_model`, которые
исполняются при импорте: правка модели, не отражённая в конвертере, краснеет
здесь, до того как это увидит пользователь.

Тест чистый — без Home Assistant. Полный путь предпросмотра требует HA и живёт
в `test_ha_sh3d_convert.py`.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from custom_components.houseplan.const import EXPORT_VERSION, PLAN_MODEL_VERSION
from custom_components.houseplan.coordinate_canonicalization import (
    canonicalize_lattice_coordinate,
)
from custom_components.houseplan.validation import CONFIG_SCHEMA
from custom_components.houseplan.wall_segment_model import (
    WALL_SEGMENT_MODEL_VERSION,
    _wall_key,
    commit_wall_segment_model,
)

REPO = Path(__file__).resolve().parent.parent
GOLDEN = REPO / "scripts" / "sh3d-convert" / "golden"
CONVERT = REPO / "scripts" / "sh3d-convert" / "convert.mjs"


def documents() -> list[tuple[str, dict]]:
    files = sorted(GOLDEN.glob("*.space-*.json"))
    assert files, "golden конвертера пропали — гейт остался бы зелёным ни на чём"
    return [(path.name, json.loads(path.read_text(encoding="utf-8"))) for path in files]


def _source_constant(name: str) -> str:
    """Значение константы из конвертера: расхождение обязано быть видно здесь."""
    match = re.search(rf"^export const {name} = (.+);$", CONVERT.read_text(encoding="utf-8"),
                      re.MULTILINE)
    assert match, f"в конвертере нет константы {name}"
    return match.group(1).strip().strip("'\"")


@pytest.mark.parametrize(("name", "document"), documents())
def test_issue_446_envelope_matches_the_import_contract(name: str, document: dict) -> None:
    """Конверт документа — ровно то, что требует `parse_document`."""
    assert document["format"] == "houseplan-export", name
    assert document["export_version"] in (1, EXPORT_VERSION), name
    assert document["kind"] == "space", name
    assert 0 <= document["model_version"] <= PLAN_MODEL_VERSION, name
    assert document["transfer"] == {"plan_only": True}, name
    assert document["placement_manifest"] == [], name
    assert document["content_manifest"] == [], name
    assert document["payload"]["layout"] == {}, name
    config = document["payload"]["config"]
    assert config["markers"] == [], name
    assert len(config["spaces"]) == 1, "plan-only требует ровно одно пространство"


def test_issue_446_converter_declares_a_version_the_import_accepts() -> None:
    """Модель документа не должна обогнать установку.

    Конвертер объявляет форму v7 сознательно: структуру (сегменты, wall_ids,
    хосты проёмов) собирает серверный писатель импорта. Значение больше
    `PLAN_MODEL_VERSION` импорт отвергнет как `future_model`.
    """
    declared = int(_source_constant("MODEL_VERSION"))
    assert declared <= PLAN_MODEL_VERSION
    assert declared < WALL_SEGMENT_MODEL_VERSION, (
        "форма v7 выбрана намеренно: при v8+ схема требует полный каталог сегментов,"
        " и конвертер обязан был бы повторить серверный алгоритм"
    )
    assert int(_source_constant("EXPORT_VERSION")) in (1, EXPORT_VERSION)


@pytest.mark.parametrize(("name", "document"), documents())
def test_issue_446_golden_passes_the_real_config_schema(name: str, document: dict) -> None:
    config = dict(document["payload"]["config"])
    config["model_version"] = document["model_version"]
    validated = CONFIG_SCHEMA(json.loads(json.dumps(config)))
    space = validated["spaces"][0]
    assert space["rooms"], name
    assert "wall_segments" not in space, "форма v7 не несёт каталога сегментов"


@pytest.mark.parametrize(("name", "document"), documents())
def test_issue_446_server_writer_turns_the_document_into_a_valid_plan(
    name: str, document: dict,
) -> None:
    """То, что делает apply: миграция v7 → v9 и повторная проверка схемой."""
    config = dict(document["payload"]["config"])
    config["model_version"] = document["model_version"]
    migrated, _ = commit_wall_segment_model(CONFIG_SCHEMA(json.loads(json.dumps(config))))
    assert migrated["model_version"] == WALL_SEGMENT_MODEL_VERSION
    space = migrated["spaces"][0]
    segments = space["wall_segments"]
    assert segments, name
    for room in space["rooms"]:
        assert len(room["wall_ids"]) == len(room["poly"]), "по идентификатору на ребро"
    owners: dict[str, int] = {segment["id"]: 0 for segment in segments}
    for room in space["rooms"]:
        for segment_id in room["wall_ids"]:
            owners[segment_id] += 1
    assert all(1 <= count <= 2 for count in owners.values()), "сегмент без комнаты недопустим"
    CONFIG_SCHEMA(json.loads(json.dumps(migrated)))


def test_issue_446_shared_boundary_becomes_one_segment_and_doors_get_hosts() -> None:
    """Ради этого конвертер и выравнивает вершины по осевым линиям стен."""
    document = json.loads((GOLDEN / "flat-two-rooms.space-1.json").read_text(encoding="utf-8"))
    config = dict(document["payload"]["config"])
    config["model_version"] = document["model_version"]
    migrated, _ = commit_wall_segment_model(CONFIG_SCHEMA(json.loads(json.dumps(config))))
    space = migrated["spaces"][0]
    assert len(space["wall_segments"]) == 7, "восемь рёбер, общая граница склеена в одно"
    shared = [
        segment for segment in space["wall_segments"]
        if sum(segment["id"] in room["wall_ids"] for room in space["rooms"]) == 2
    ]
    assert len(shared) == 1, "общая стена двух комнат обязана быть одним сегментом"
    hosts = [opening.get("host") for opening in space["openings"]]
    assert all(isinstance(host, dict) and host.get("kind") == "wall" for host in hosts), (
        f"сервер обязан сам привязать проёмы к стенам, получено {hosts}"
    )


def test_issue_446_ported_formulas_match_python() -> None:
    """Те же значения закреплены в test/sh3d-convert.test.mjs.

    Формулы `_wall_key` и канонизации портированы в JS. Если они разойдутся,
    сервер не найдёт толщину для рёбер, и стены приедут нулевыми — молча.
    Расхождение краснит один из двух тестов.
    """
    assert _wall_key([0.25, 0.3333333333333333], [0.5, 0.3333333333333333]) == (
        "0.375000,0.333333@0.0000")
    assert _wall_key([0.5, 0.3333333333333333], [0.5, 0.6666666666666666]) == (
        "0.500000,0.500000@1.5706")
    # 0.2499999 отличает две ветки канонизации: сваливание шума в узел даёт
    # 0.25, а простое округление до девяти знаков — 0.2499999. Значение с
    # одиннадцатью девятками (первая редакция теста) обе ветки давали одинаково,
    # то есть пин ничего не проверял.
    assert canonicalize_lattice_coordinate(0.2499999) == 0.25
    assert canonicalize_lattice_coordinate(0.123456789012) == 0.123456789
