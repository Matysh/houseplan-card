# #1341 — malformed device registry identifiers must not stop LQI

Owner feedback: HA Core2026.10.4 / Houseplan1.84.0, five samoswall/polaris-mqtt devices have three-element identifiers; the shared30second update raises ValueError in zigbee_lqi.py:201. Original registry records were not supplied. Test identifiers are synthetic.

The same unchecked unpack remains in dev b01159e90270a4a454be4d7acbca9d90a51760f7. Only devices represented by active markers or bound areas enter this loop. The failed structural rebuild retains the dirty flag, so subsequent ticks retry it.

Change: validate each identifier as a tuple/list with exactly2elements before unpacking. Skip invalid records without truncation; retain valid pairs on the same device. IEEE parsing, provider/config-entry ownership, conflict refusal, subscriptions, timer cadence and snapshot format are unchanged. No registry writes or UI changes are added.

Regression: test_ha_zigbee_lqi.py creates five actual HA registry devices with synthetic triples in a bound room beside valid MQTT/ZHA radios. Both valid radios also carry malformed Zigbee-looking triples; extra radios exist in provider data, so truncating records or dropping the whole device fails the assertions. Initial refresh, a subsequent registry event, cached ZHA update and periodic tick all preserve valid readings (including genuine0) and never publish/scan. Eight additional reader-boundary cases cover wrong type/arity alongside a valid list pair.

Before the fix, the real-registry regression raised the exact reported ValueError. The first post-fix test attempt lacked a delivered MQTT inventory on an existing subscription; the fixture now emits it through the real existing transport callback, keeping its binding assertions. Final addressed run:

    python3 -m pytest -q tests_backend/test_ha_zigbee_lqi.py tests_backend/test_ha_zigbee_lqi_performance.py tests_backend/test_zigbee_lqi_model.py

Result:52passed in2.60s. Environment: Python3.14.7, homeassistant2026.8.3, pytest-homeassistant-custom-component0.13.357 (the repository's pinned HA harness). This is not claimed as an installed user-HA or Core2026.10.4 browser run. Local red/green logs are retained in output/issue1341. Final S6/merge evidence is published by finish in issue#1341.