# Additional backend findings from #1226

## BE-REPAIR-10 — ambiguous legacy model10 carrier is rehosted

The existing `test_between_two_eligible_walls_the_next_write_decides[10-detached]`
still fails after restoring its raw legacy fixture. The old test helper had
silently migrated that fixture to model11 before calling the raw model10
import-repair function. It now uses the dedicated
`decode_legacy_wall_segment_model` and independently checks the later model11
migration.

With the correct model10 fixture, `repair_imported_openings(config, 10)` returns
one rehosted opening between two eligible walls. Its established fail-closed
oracle expects one detached opening. In `opening_repair._place_on_wall`, the
uniqueness condition is `model >= WALL_SEGMENT_MODEL_VERSION`; that constant is
now11, while the function's own documentation still promises the unique-carrier
rule for model10. The test's model9 case retains the initial-migration tie-break.

Reproduction:

```text
python -m pytest -q tests_backend/test_opening_repair.py -k between_two_eligible
```

Evidence: `output/issue1226/backend-addressed.xml`, one failure alongside239
passing addressed backend tests. No product code or expected result changed.
This finding is separate from Optimize fixed-point #1224 and relay drift #1223.

## Existing linked product boundary

`test_plan_graph_support::test_closed_schema_relay_twin_is_exact` stays red until
#1223 fixes the actual relay schema drift. This task does not weaken the
privacy/schema parity check or modify the deployed relay.
