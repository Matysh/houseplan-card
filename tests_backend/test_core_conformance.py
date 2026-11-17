"""The shipped adapter scenarios are executable, not a prose checklist."""
import pytest

from custom_components.houseplan.core.conformance import ReferenceAdapter, run
from custom_components.houseplan.core.conformance_example import JsonClientAdapter


@pytest.mark.parametrize("factory", [ReferenceAdapter, JsonClientAdapter])
async def test_reusable_scenarios_accept_an_external_factory(tmp_path, factory):
    completed = await run(factory, tmp_path)
    assert len(completed) == 9
    assert len(set(completed)) == 9
