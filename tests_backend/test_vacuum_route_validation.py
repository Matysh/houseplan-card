"""Семантическая валидация маршрутов карт при config/set и импорте (#162)."""
import pytest

from custom_components.houseplan.validation import (
    MarkerControlError,
    validate_marker_vacuum_routes,
)
from custom_components.houseplan.vacuum_routes import VAC_ROUTE_ERROR

IDENTITY = [1, 0, 0, 0, 1, 0]


def _config(routes, spaces=("floor1", "floor2")):
    return {
        "spaces": [{"id": space} for space in spaces],
        "markers": [{"id": "m1", "space": "floor1", "vacuum": {"map_routes": routes}}],
    }


def _route(**over):
    base = {"id": "r1", "source": "camera.robot", "map_id": "m1",
            "space": "floor1", "calibration": IDENTITY}
    base.update(over)
    return base


def test_valid_routes_pass():
    validate_marker_vacuum_routes(_config([_route(), _route(id="r2", map_id="m2", space="floor2")]))


def test_error_code_is_the_public_contract_code():
    assert VAC_ROUTE_ERROR == "invalid_vacuum_map_route"
    with pytest.raises(MarkerControlError) as excinfo:
        validate_marker_vacuum_routes(_config([_route(space="нет такого")]))
    assert excinfo.value.code == VAC_ROUTE_ERROR


@pytest.mark.parametrize("routes", [
    [_route(space="удалённое")],
    [_route(), _route(id="r2")],
    [_route(), _route(map_id="m2")],
    [_route(calibration=[1, 2, 3])],
    [_route(source="не-entity")],
    [_route(id="")],
    ["строка вместо объекта"],
])
def test_invalid_routes_are_rejected(routes):
    with pytest.raises(MarkerControlError):
        validate_marker_vacuum_routes(_config(routes))


def test_untouched_invalid_routes_do_not_block_an_unrelated_save():
    """Смена другого поля не обязана чинить чужие/будущие данные."""
    broken = _config([_route(space="исчезнувшее")])
    previous = {"markers": [dict(broken["markers"][0])], "spaces": broken["spaces"]}
    validate_marker_vacuum_routes(broken, previous)
    # но правка самих маршрутов обязана оставить их валидными
    edited = _config([_route(space="исчезнувшее"), _route(id="r2", map_id="m2")])
    with pytest.raises(MarkerControlError):
        validate_marker_vacuum_routes(edited, previous)


def test_import_validates_everything():
    broken = _config([_route(space="исчезнувшее")])
    with pytest.raises(MarkerControlError):
        validate_marker_vacuum_routes(broken, None, validate_all=True)


def test_missing_spaces_list_skips_the_referential_check_only():
    config = {"markers": [{"id": "m1", "vacuum": {"map_routes": [_route(space="floor9")]}}]}
    validate_marker_vacuum_routes(config)
    config["markers"][0]["vacuum"]["map_routes"] = [_route(space="floor9", calibration=[1])]
    with pytest.raises(MarkerControlError):
        validate_marker_vacuum_routes(config)


def test_legacy_marker_without_routes_is_untouched():
    config = {
        "spaces": [{"id": "floor1"}],
        "markers": [{"id": "m1", "space": "floor1",
                     "vacuum": {"source": "camera.robot", "calibration": {"m1": IDENTITY}}}],
    }
    validate_marker_vacuum_routes(config, None, validate_all=True)
