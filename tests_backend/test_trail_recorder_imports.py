"""Read-only namespace observations around the recorder's isolated loader."""
import importlib.machinery
import sys

import pytest

from test_trail_recorder import _load_trails


@pytest.mark.parametrize("fail_import", [False, True])
def test_issue1057_loader_restores_module_identity_after_success_or_import_failure(monkeypatch, fail_import):
    def watched(name):
        return name in ("homeassistant", "custom_components") or name.startswith(
            ("homeassistant.", "houseplan", "custom_components.")
        )

    before = {name: module for name, module in sys.modules.items() if watched(name)}
    if fail_import:
        original_exec = importlib.machinery.SourceFileLoader.exec_module

        def failing_exec(loader, module):
            original_exec(loader, module)
            if module.__name__ == "houseplan.trails":
                raise RuntimeError("ordinary import failure after trail dependencies loaded")

        monkeypatch.setattr(importlib.machinery.SourceFileLoader, "exec_module", failing_exec)
        with pytest.raises(RuntimeError, match="ordinary import failure"):
            _load_trails()
    else:
        _load_trails()

    after = {name: module for name, module in sys.modules.items() if watched(name)}
    assert after.keys() == before.keys(), "temporary HA/alias/canonical imports must not leak"
    assert all(after[name] is module for name, module in before.items()), "real modules must keep identity"
