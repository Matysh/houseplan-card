"""Загрузка модуля интеграции по пути, без Home Assistant (issue #394).

Зачем не обычный импорт: часть чистых тестов читает модуль под своим именем
(`hp_validation`) либо под каноническим, чтобы работали относительные импорты
внутри него. Родительские пакеты при этом должны существовать — в окружении с
Home Assistant это настоящий пакет, без него пустышки ставит `conftest.py`.

Ставить пустышки здесь, в момент загрузки, было бы ошибкой: именно так они
переживали свой тест и доставались всей сессии. В #389 это стоило пяти часов
красного `dev` — HA получал пустышку вместо интеграции и не мог её поднять.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PACKAGE_ROOT = REPO / "custom_components"
HOUSEPLAN_ROOT = PACKAGE_ROOT / "houseplan"


def load_pure(name: str, file: Path):
    """Загрузить модуль по пути под указанным именем.

    Имя значимо: относительные импорты внутри модуля резолвятся только тогда,
    когда модуль знает, какому пакету принадлежит.
    """
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module
