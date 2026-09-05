"""Загрузка модуля интеграции по пути, без Home Assistant (issue #394).

Зачем не обычный импорт: часть чистых тестов читает модуль под своим именем
(`hp_validation`) либо под каноническим, чтобы работали относительные импорты
внутри него. Родительские пакеты при этом должны существовать — в окружении с
Home Assistant это настоящий пакет, без него пустышки ставит `conftest.py`.

Здесь используется отдельный временный namespace. Он обязательно снимается в
`finally`, после чего исходное состояние импорт-машины восстанавливается по
идентичности объектов. Это принципиальное отличие от утечки пустышек из #389,
из-за которой HA получал заглушку вместо интеграции и не мог её поднять.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

REPO = Path(__file__).resolve().parent.parent
PACKAGE_ROOT = REPO / "custom_components"
HOUSEPLAN_ROOT = PACKAGE_ROOT / "houseplan"


def _is_custom_components_entry(key: str) -> bool:
    """Принадлежит ли имя ровно namespace `custom_components`."""
    return key == PACKAGE_ROOT.name or (
        key.startswith(PACKAGE_ROOT.name)
        and key[len(PACKAGE_ROOT.name):].startswith(".")
    )


def _namespace_package(name: str, path: Path) -> ModuleType:
    """Минимальный package, достаточный для абсолютных/относительных импортов."""
    module = ModuleType(name)
    module.__package__ = name
    module.__path__ = [str(path)]
    return module


def load_pure(name: str, file: Path):
    """Загрузить модуль по пути под указанным именем и убрать за собой.

    Имя значимо: относительные импорты внутри модуля резолвятся только тогда,
    когда модуль знает, какому пакету принадлежит.

    Регистрация в `sys.modules` обязательна на время `exec_module` и вредна
    после (#398). Она переживала вызов и доставалась всей сессии — тот же
    класс, что #389: загрузчик Home Assistant получал бы модуль, собранный
    мимо него, а объекты классов одного файла оказывались бы разными.

    В окружении с установленным HA нельзя позволять импорту соседнего модуля
    запустить настоящий `houseplan/__init__.py`: он может вернуться к ещё не
    исполненному pure-модулю и образовать цикл (#465). Поэтому весь namespace
    `custom_components` временно заменяется двумя package-пустышками с
    настоящими путями. В `finally` временное дерево удаляется, а полный снимок
    исходных имён и объектов восстанавливается. Это сохраняет и пустышки
    `conftest.py`, и уже загруженные настоящие модули без подмены по identity.
    """
    before = frozenset(sys.modules)
    spec = importlib.util.spec_from_file_location(name, file)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot create import spec for {name} from {file}")
    module = importlib.util.module_from_spec(spec)

    saved = {
        key: sys.modules[key]
        for key in before
        if _is_custom_components_entry(key) or key == name
    }
    try:
        for key in tuple(saved):
            sys.modules.pop(key, None)

        package = _namespace_package(PACKAGE_ROOT.name, PACKAGE_ROOT)
        houseplan = _namespace_package(
            f"{PACKAGE_ROOT.name}.houseplan", HOUSEPLAN_ROOT)
        package.houseplan = houseplan
        sys.modules[PACKAGE_ROOT.name] = package
        sys.modules[f"{PACKAGE_ROOT.name}.houseplan"] = houseplan
        sys.modules[name] = module
        spec.loader.exec_module(module)
    finally:
        for key in [
            key for key in sys.modules
            if _is_custom_components_entry(key) or key == name
        ]:
            del sys.modules[key]
        sys.modules.update(saved)
    return module
