# #1296 — synchronizing the real HA profile hold

Companion source: [ceec9aec155585096880863a076aaf9d2e81a0da](https://github.com/Matysh/houseplan-e2e/commit/ceec9aec155585096880863a076aaf9d2e81a0da).
Only `tests/lib/panel-profiles.mjs` changes executable behavior. The root change
records the cross-repository result; root documentation needs no test/build/lint.
The independent reviewer should also assess the complete narrow helper change below.

The old helper pressed the native pointer for3100ms, released it, then expected
the dialog. The product's3000ms timer may arrive later under load; pointerup
correctly cancels an incomplete hold. The helper now keeps the real pointer down
until the public dialog is visible. The existing expect timeout stays unchanged;
finally releases the pointer on success or failure. No runtime/private hook,
forced opening, retry, timeout increase or rights change is involved.

```diff
 export async function sizeDialog(page, host) {
   const surface = stage(host); await surface.scrollIntoViewIfNeeded();
   const box = await surface.boundingBox();
   await page.mouse.move(box.x + 8, box.y + 8);
-  await page.mouse.down();
-  try { await page.waitForTimeout(3100); } finally { await page.mouse.up(); }
   const dialog = host.locator(HP.dialog('kiosk')).first();
-  await expect(dialog).toBeVisible(); return dialog;
+  await page.mouse.down();
+  // The browser may deliver its 3s hold callback after 3100ms under load.
+  // Keep the native pointer down until the real dialog appears; release also
+  // on failure, so no later step inherits a pressed mouse button.
+  try { await expect(dialog).toBeVisible(); } finally { await page.mouse.up(); }
+  return dialog;
 }
```

## Executed evidence

Product: exact published beta.5, source a4dd940c1190ee62581c187fa500db3c73f66d1c,
ZIP SHA256 ec36f4646787976255bdd09adc8d49c32dfbf3bd2f0936e0c64d9ddb7ea6b173,
HA2026.10.4. A copied laboratory test delays only public window.setTimeout
callbacks whose requested delay is3000ms until3600ms; all other timers and all
assertions of the full deletion/new-ID/read-only journey remain unchanged.
This deterministically demonstrates the race class; it does not prove the exact
CPU/timer timeline of the original failing stable CI.

| Helper | Business | Setup | Skips/retries | Result |
|---|---|---|---|---|
| Original |0/1|3/3|0/0|FAIL: kiosk dialog toBeVisible, element not found|
| Fixed |1/1|3/3|0/0|PASS: same complete journey and delayed callback|

Both runs use owned laboratories; mES68H and3y9QB7 containers were removed by
the adapter. Reports remain in `output/issue-1296/{old-hold,fixed-hold}/labs/*/artifacts/results.json`
of the release checkout. Companion contract lint passed57files. Assertions still
cover old/deleted/new profile identities, scale100/100 and250/200, locked controls,
read-only behavior and unauthorized writes. No full stable rerun is claimed.

The empty-space Undo issue was already fixed by companion1736049f9f98bdf16ac2ab57de2916f0c9310fbb:
ready/stage and exact config/layout after reload, then select the original nonempty
floor. Its real HA addressed run on the same ZIP passed previously (setup3/3,
business2/3 overall, the remaining failure was Resize). No new product bug is
attributed to that precondition. Full details and explicit HA scope are retained
in companion `task-impact/houseplan-card-1296.md` at the pinned commit above.