"""Physical work remains bounded after caller timeout/cancellation (#942)."""

import asyncio

import pytest

from custom_components.houseplan.support_builds import SupportBuildPool


@pytest.mark.asyncio
async def test_timeout_keeps_physical_lease_until_completion_and_stale_release_is_inert():
    pool = SupportBuildPool()
    lease = pool.acquire("owner", "draft")
    future = asyncio.get_running_loop().create_future()
    with pytest.raises(TimeoutError):
        await pool.await_physical("owner", "draft", lease, future, timeout=0)
    assert not future.cancelled()
    assert pool.acquire("owner", "draft") is None
    assert len(pool.leases) == 1
    future.set_result((b"snapshot", {}))
    await asyncio.sleep(0)
    successor = pool.acquire("owner", "draft")
    assert successor is not None
    pool.release("owner", "draft", lease)
    assert pool.leases[("owner", "draft")] is successor


@pytest.mark.asyncio
async def test_global_budget_and_parent_cancellation_do_not_cancel_physical_job():
    pool = SupportBuildPool()
    leases = [pool.acquire("owner", str(index)) for index in range(4)]
    assert all(leases) and pool.acquire("other", "extra") is None
    future = asyncio.get_running_loop().create_future()
    waiting = asyncio.create_task(pool.await_physical("owner", "0", leases[0], future))
    await asyncio.sleep(0)
    waiting.cancel()
    with pytest.raises(asyncio.CancelledError):
        await waiting
    assert not future.cancelled() and len(pool.leases) == 4
    future.set_exception(ValueError("private error never logged"))
    await asyncio.sleep(0)
    assert len(pool.leases) == 3
