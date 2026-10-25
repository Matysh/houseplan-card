"""#1061 exact Align admission and unchanged carrier/opening refusals."""
import copy
import json
from pathlib import Path

import pytest

from custom_components.houseplan import validation as v

CASES = json.loads((Path(__file__).parents[1] / "test" / "fixtures"
                    / "1061-align-carrier.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["name"])
def test_exact_producer_align_is_admitted_without_replacement_room(case):
    before, after = copy.deepcopy(case["source"]), copy.deepcopy(case["candidate"])
    snapshot = copy.deepcopy((before, after))
    v.validate_partition_opening_hosts(after, before, allow_optimize_rehost=True)
    assert (before, after) == snapshot


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["name"])
@pytest.mark.parametrize("mutation", ["short-a", "short-b", "foreign-id", "drop", "narrower", "future"])
def test_unproved_carrier_delta_remains_refused(case, mutation):
    before, after = copy.deepcopy(case["source"]), copy.deepcopy(case["candidate"])
    space = after["spaces"][0]
    partition = space["partitions"][0]
    if mutation == "short-a":
        partition["a"][0] += 0.00001
    elif mutation == "short-b":
        partition["b"][0] -= 0.00001
    elif mutation == "foreign-id":
        partition["id"] = "foreign"
    elif mutation == "drop":
        space["partitions"] = []
    elif mutation == "narrower":
        partition["cm"] = 10
    else:
        partition["future_semantics"] = True
    with pytest.raises(v.PartitionOpeningHostError):
        v.validate_partition_opening_hosts(after, before, allow_optimize_rehost=True)


def test_unknown_existing_carrier_is_not_claimed_as_known_align():
    before, after = copy.deepcopy(CASES[0]["source"]), copy.deepcopy(CASES[0]["candidate"])
    for config in (before, after):
        config["spaces"][0]["partitions"][0]["future_semantics"] = True
    with pytest.raises(v.PartitionOpeningHostError, match="optimize delta unproved"):
        v.validate_partition_opening_hosts(after, before, allow_optimize_rehost=True)


def test_retained_carrier_align_reproduces_the_original_hosted_fit_condition():
    before, after = copy.deepcopy(CASES[1]["source"]), copy.deepcopy(CASES[1]["candidate"])
    # Fits the old .5002 axis, but not the .5 snapped axis. The existing TS
    # Align must retain this carrier; deleting the record cannot prove its trim.
    before["spaces"][0]["openings"][0]["length"] = 0.5001
    after["spaces"][0]["openings"] = []
    with pytest.raises(v.PartitionOpeningHostError, match="optimize delta unproved"):
        v.validate_partition_opening_hosts(after, before, allow_optimize_rehost=True)


def test_valid_original_hosted_record_cannot_disappear_from_exact_align():
    before, after = copy.deepcopy(CASES[1]["source"]), copy.deepcopy(CASES[1]["candidate"])
    after["spaces"][0]["openings"] = []
    with pytest.raises(v.PartitionOpeningHostError, match="optimize delta unproved"):
        v.validate_partition_opening_hosts(after, before, allow_optimize_rehost=True)


def test_hosted_fit_uses_the_existing_pre_align_scalar_canonicalization():
    before, after = copy.deepcopy(CASES[1]["source"]), copy.deepcopy(CASES[1]["candidate"])
    # The existing scalar canonicalizer resolves .50000000834 to .500000008
    # before Align's exact EPS check. Raw pre-canonical input is a different oracle.
    before["spaces"][0]["openings"][0]["length"] = 0.50000000834
    after["spaces"][0]["openings"][0]["length"] = 0.500000008
    assert v._exact_partition_align(before["spaces"][0]["partitions"][0],
                                   after["spaces"][0]["partitions"][0], before["spaces"][0], after["spaces"][0])


def test_the_new_align_exception_is_not_a_global_opening_drop_ban():
    before = copy.deepcopy(CASES[1]["source"])
    after = copy.deepcopy(before)
    after["spaces"][0]["openings"] = []
    # No carrier trim: the existing ordinary Optimize policy remains in charge.
    v.validate_partition_opening_hosts(after, before, allow_optimize_rehost=True)


@pytest.mark.parametrize("mutation", ["host-drop", "foreign-host", "jamb"])
def test_align_does_not_bypass_opening_host_and_fit(mutation):
    before, after = copy.deepcopy(CASES[1]["source"]), copy.deepcopy(CASES[1]["candidate"])
    opening = after["spaces"][0]["openings"][0]
    if mutation == "host-drop":
        opening.pop("host")
    elif mutation == "foreign-host":
        opening["host"]["id"] = "foreign"
    else:
        opening["length"] = 0.6
    with pytest.raises((v.PartitionOpeningHostError, v.PartitionOpeningJambMarginError)):
        v.validate_partition_opening_hosts(after, before, allow_optimize_rehost=True)


def test_javascript_negative_half_tie_and_storage_formula_are_exact():
    before = {"id": "p", "a": [-0.00625, 0.25], "b": [0.75, 0.25], "cm": 0}
    after = {**before, "a": [-1 / 240, 0.25]}
    assert v._exact_partition_align(before, after, {}, {})
    assert not v._exact_partition_align(before, {**after, "a": [-2 / 240, 0.25]}, {}, {})
    assert not v._exact_partition_align(before, {**after, "cm": 20}, {}, {})
    assert not v._exact_partition_align({**before, "b": before["a"]}, {**after, "b": after["a"]}, {}, {})
    for field in ("id", "cm", "a", "b"):
        incomplete = {key: value for key, value in before.items() if key != field}
        assert not v._exact_partition_align(incomplete, after, {}, {})
    for cm in (True, -1, float("nan"), float("inf")):
        assert not v._exact_partition_align({**before, "cm": cm}, {**after, "cm": cm}, {}, {})
