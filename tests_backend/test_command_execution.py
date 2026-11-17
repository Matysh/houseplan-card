"""Deadline and ContextVar lifetime must never reject an already-durable write."""
from dataclasses import replace

import pytest
from test_plan_commands import service

from custom_components.houseplan.core import command_execution, plan_commands
from custom_components.houseplan.core.command_execution import (
    begin_preparation,
    command_preparation,
    finish_preparation,
)
from custom_components.houseplan.core.command_ports import CommandError
from custom_components.houseplan.core.input_policy import (
    STRICT_INPUT_POLICY,
    InputLimit,
    charge_work,
    current_policy,
    input_scope,
)
from custom_components.houseplan.core.memory_host import (
    MemoryPlanTransaction,
    ThreadCpuExecutor,
)


def clocked(monkeypatch):
    clock = [0.0]

    def scope(policy):
        return input_scope(policy, clock=lambda: clock[0])

    monkeypatch.setattr(command_execution, "input_scope", scope)
    return clock


async def test_deadline_before_commit_refuses_without_mutation(monkeypatch):
    clock = clocked(monkeypatch)
    commands = service()
    before = commands.storage.snapshot()
    original = plan_commands.validate_contact_bases

    def delayed(*args):
        original(*args)
        clock[0] += 6

    monkeypatch.setattr(plan_commands, "validate_contact_bases", delayed)
    with pytest.raises(CommandError) as error:
        await commands.execute({"type": "houseplan/layout/set", "layout": {}, "expected_rev": 7})
    assert error.value.code == "capacity_exceeded"
    assert commands.storage.snapshot() == before
    assert commands.effects.events == []


async def test_slow_durable_commit_does_not_get_a_late_deadline_failure(monkeypatch):
    clock = clocked(monkeypatch)
    commands = service()
    original = MemoryPlanTransaction.save_layout

    async def delayed(self, *args, **kwargs):
        await original(self, *args, **kwargs)
        clock[0] += 60

    monkeypatch.setattr(MemoryPlanTransaction, "save_layout", delayed)
    assert await commands.execute({"type": "houseplan/layout/set", "layout": {}, "expected_rev": 7}) == {"ok": True, "rev": 8}
    assert commands.storage.layout_data["rev"] == 8
    assert commands.effects.events == [("houseplan_layout_updated", {"rev": 8})]


async def test_executor_jobs_share_one_request_budget_and_policy():
    executor = ThreadCpuExecutor()
    policy = replace(STRICT_INPUT_POLICY, geometry_units=2)

    def work(units):
        assert current_policy() is policy
        charge_work(units)

    with pytest.raises(InputLimit):
        with command_preparation(policy):
            begin_preparation()
            await executor.run(work, 2)
            await executor.run(work, 1)
            finish_preparation()


async def test_outer_budget_cannot_survive_a_durable_command(monkeypatch):
    commands = service()
    before = commands.storage.snapshot()
    with input_scope(STRICT_INPUT_POLICY):
        with pytest.raises(ValueError, match="owns the preparation scope"):
            await commands.execute({"type": "houseplan/layout/set", "layout": {}, "expected_rev": 7})
    assert commands.storage.snapshot() == before
