"""#446: golden конвертера Sweet Home 3D проходят настоящий предпросмотр импорта.

Самое сильное звено гейта против дрейфа: здесь документ, который получает
пользователь со страницы `/convert`, скармливается той же функции
`create_preview`, что и загрузка через интерфейс карточки. Модуль требует Home
Assistant (импорт тянет `store`), поэтому файл назван `test_ha_*` и локально
пропускается — в Linux CI он исполняется.

Чистая половина проверок — в `test_sh3d_convert.py`.
"""
from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from custom_components.houseplan.import_export import ImportFailure, create_preview

GOLDEN = Path(__file__).resolve().parent.parent / "scripts" / "sh3d-convert" / "golden"


def golden_documents() -> list[tuple[str, dict]]:
    files = sorted(GOLDEN.glob("*.space-*.json"))
    assert files, "golden конвертера пропали"
    return [(path.name, json.loads(path.read_text(encoding="utf-8"))) for path in files]


def _preview(document: dict, root: Path) -> dict:
    return create_preview(
        SimpleNamespace(instance_id="target-instance", import_previews={}),
        json.dumps(document).encode(),
        owner_id="alice",
        duplicate_policy="skip",
        current_config_data={"config": {"spaces": [], "markers": []}, "rev": 0},
        current_layout_data={"layout": {}, "rev": 0},
        config_root=root,
    )


@pytest.mark.parametrize(("name", "document"), golden_documents())
def test_issue_446_import_preview_accepts_the_converted_document(
    name: str, document: dict, tmp_path,
) -> None:
    response = _preview(document, tmp_path / "target")
    preview = response["preview"]
    assert response["token"], name
    assert preview["counts"]["spaces"] == 1, name
    assert preview["counts"]["rooms"] >= 1, name
    assert preview["counts"]["markers"] == 0, "конвертер не приносит устройств"
    assert preview["content"] == [], "и не приносит файлов"
    # Чужой источник — законное состояние: документ сделан не этой установкой.
    assert "foreign_source" in preview["warnings"], name
    assert "full_replaces_current" not in preview["warnings"], "этаж добавляется, не заменяет план"


def test_issue_446_plan_only_flag_survives_the_privacy_projection(tmp_path) -> None:
    """`plan_only: true` — обещание, которое сервер проверяет пересчётом.

    Если конвертер положит в пространство поле вне разрешённого набора,
    предпросмотр откажет с `invalid_format`. Тест держит это обещание честным:
    подмена документа лишним полем обязана отказать.
    """
    name, document = golden_documents()[0]
    forged = json.loads(json.dumps(document))
    forged["payload"]["config"]["spaces"][0]["plan_url"] = "/api/houseplan/content/plans/x.png"
    with pytest.raises(ImportFailure):
        _preview(forged, tmp_path / "forged")
    # А неподделанный проходит — иначе предыдущая проверка ничего не значит.
    assert _preview(document, tmp_path / "clean")["token"], name
