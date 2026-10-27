# Scoped config/set — #1096

## Scope and reproducibility

Base: `dev` @ `80349ae3f` (2026-10-27; the write path has not changed since
`51fde59d`, on which the #1094 audit was made). After: the #1096 implementation
on branch `issue/1096-config-set-scoped-validation`. Both measured in the same
process by the same test, on the browser fixture `demo/fixtures/large-house.mjs`
(3 floors, 60 rooms, 147 wall segments, 20 markers; a legacy pre-v8 document,
so a floor edit also pays its wall-model migration in the junction step). No
private HA export is used.

Backend command:

```sh
python -m pytest tests_backend/test_ha_config_set_scoped.py -q -s -k budget
```

Pinned HA venv (Python 3.14, Home Assistant 2026.8.3, the installed pytest HA
plugin), Linux sandbox. The test sends authenticated `houseplan/config/set`
through the registered handler and the real HA Store. For each scenario the
full pass (the clean stamp cleared before the write) and the scoped pass
alternate, 7 repeats each, every sample a real new revision; the executor CPU
phase `_validate_config_cpu` is timed by an observer that delegates the call
unchanged, and the medians are compared. The thresholds are relative
(settings-only and marker-only ≤ 10 % of the full pass, one floor ≤ 50 %);
the absolute times are reported, not judged.

## Results

Milliseconds, medians of 7. "ACK" is the client's round trip for the write
(JSON over the WS, validation, Store write, events); "CPU" is the executor
validation phase only.

| Scenario | CPU full → scoped | ratio | budget | ACK full → scoped |
|---|---:|---:|---:|---:|
| settings-only (`show_room_tooltip`) | 153.9 → 1.7 | 0.011 | ≤ 0.10 | 205.0 → 48.4 |
| marker-only (marker name) | 168.9 → 1.7 | 0.010 | ≤ 0.10 | 224.0 → 51.9 |
| one floor (decor line on floor 2) | 162.0 → 54.1 | 0.334 | ≤ 0.50 | 236.9 → 104.7 |
| one floor, largest (floor 1: 250 stairs, half of the bytes) | 157.9 → 60.9 | 0.386 | reported only | 204.3 → 110.6 |

On the unchanged base the same test measures ratio 1.05 (settings-only) and
1.02 (marker-only): every ordinary write there is a full pass, and the AC2
counters show every floor twice (schema and the second canonicalisation in
`async_save_config_state`).

## Where the scoped settings-only write spends its time

Phase observers on the same run (one settings-only write, milliseconds):

| Phase | ms |
|---|---:|
| `_resolved_write_pair` (both Store halves under the lock) | 5.0 |
| `async_save_config_state` (of which `config_store.async_save` 4.7) | 5.7 |
| executor `_validate_config_cpu` | 2.3 |
| executor `_missing_internal_plans` | 1.7 |
| executor `_collect` (plans/attachments; the `files` root listing for the `up_*` sweep) | 1.5 |
| `prepare_ordinary_summary_candidate` (preservation + scope + projection) | 0.8 |
| `ordinary_write_scope` (record-by-record `==`) | 0.6 |
| everything else (marker validators, passages, hosts, junction copy) | < 1.0 |

The remaining ≈ 20 ms of the 48 ms ACK is the WS layer: decoding the 168 KB
message and the size check (`json.dumps`) before the handler, outside this task.

Before the junction step was scoped by migration, not only by counting,
`validate_junction_limits` alone cost 80–160 ms on a settings-only write of
this legacy fixture: `_migrated_spaces` migrated all three floors before the
per-space skip. Only the touched (and new) spaces go through the migration now.

## Witnesses

`tests_backend/test_ha_config_set_scoped.py`: AC1 corpus equality (small v10
house and large-house: settings, marker, decor, wall, new/removed space, LED
links across spaces, `bg_mode`, `model_version`, legacy previous without
`name_color`/`wall_fill`; the same `vol.Invalid` text for a broken floor or
over-cap list), AC2/AC5 counters on real writes with the clean-stamp lifecycle
(first write, `marker/copy`, restart, conflict and invalid writes), AC3
restricted household user and the per-id readable lookup, AC4 radar registry
evidence, AC6 one canonicalisation / no second Store read / no `config/get`
copy of a materialised document, AC7 folder listings, AC8 LQI scope key, AC10
budget above. `tests_backend/test_validation.py::test_issue_1096_config_schema_is_idempotent_on_its_own_output`
pins the `CONFIG_SCHEMA` step tuple and `CONFIG_SCHEMA(stored) == stored` on
large-house, visual-matrix, the glow fixture, a legacy-selector document, LED
links and stairs.
