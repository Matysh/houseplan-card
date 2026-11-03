# S6 advisory quality review

This is preliminary read-only review of selected fixture ports at root commit `1a4d85856`, not the required S7 review, visual acceptance or completion of #1226. No reviewer tests, writes or status changes were performed.

## Root Node / Python ports

Separate reviewer: High0 / Medium0. The writer tests retain current invalid-host rejection, full-byte stored legacy orphan preservation, unknown metadata and column refusal. Explicit endpoint references identify one known shared node. Atomisation has exact geometry plus independent continuous coverage and consumed-wall thickness checks. The current config+API2 receipt is compared in full and independently stored/undone through Python HA WS. The frozen model10 capture and both legacy parameters remain unchanged.

## Root browser / golden observers

Separate reviewer: High0 / Medium0 / Low1. Retained pan observes real held paint and the committed camera. Stair focus keeps keyboard modality, focus-visible, exact pixel equality and Enter. Coverage observes both actual physical producers with cold-positive and zero-hot assertions. Furniture preparation uses exposed native SVG hits and no forced click. Visual baselines remain unaccepted.

Low: the backdrop fallback selector contained Playwright `:visible`, while `q()` passes it to native DOM `querySelectorAll`. The current wide path did not enter that branch, but the fallback would throw SyntaxError. Author removed the Playwright pseudo-class; locator.click still enforces native visible actionability. An addressed browser probe validated both native CSS branches (counts1/1, exit0). The already passing complete wide backdrop suite was not repeated solely for this fallback selector correction.

Original advisory verdict remains High0 / Medium0 / Low1 with the Low resolved by the author. Official finish/review waits for the task's outstanding AC and blockers.