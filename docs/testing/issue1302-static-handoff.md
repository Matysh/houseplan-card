# #1302 — Static handoff fixture isolation

Companion change: [6452c23857420b43f14789f226ead3a76527049b](https://github.com/Matysh/houseplan-e2e/commit/6452c23857420b43f14789f226ead3a76527049b).
The independent reviewer should assess the entire narrow executable change
below, including the unchanged real-transport contract around it. The root
change records this cross-repository fix; no root test/build/lint is needed.

## Confirmed failure

The original failed [stable audit](https://github.com/Matysh/houseplan-card/actions/runs/41964857128)
trace snapshot at 656549.096 contains FOUR houseplan-space-card hosts:
two under HUI-HORIZONTAL-STACK-CARD and two directly under the fixture DIV.
After B auth_ok at 656416.126, Houseplan reads still used A request IDs73/74
and75/76, while B sent registry read IDs1/2. B had no held Houseplan replies.
Removing only Lovelace card children did not detach their owning application;
an ordinary HA update let Lovelace recreate the A-owned pair. The resulting
connected A cards could claim the shared store during B adoption.
The sanitized trace extraction records only method/type/id/revision and DOM
tag ancestry. Auth and state/config payloads are never copied to this record.

## Change and boundaries

Detach this page's home-assistant application root before creating the owned
Static pair. The real authenticated A connection is retained; B still uses a
second genuine authenticated WebSocket. The original application can update
detached descendants but cannot reconnect its cards to the document. Reload
restores the normal HA page. This is fixture isolation, not a product reset.
Two-host assertions and a finally-attached safe wire receipt expose any
future failure. Existing reply holds, real bus high-water on A, low-revision B,
both Static paints and native ACK/readback/reload assertions remain intact.
No timeout increase, retries, forced reads or invented responses.

## Executed verification

Exact published beta.6 ZIP SHA256:
a358da2ee9ca8538d27f486d9254b67c05256fa4f4bdb1243d49e7e341ea36e2.
Own HA2026.10.4 lab hp-e2e-journeys-AITT9A: business1/1, setup3/3,
skip/unexecuted/retry0; container removed by adapter. The complete fifth
static-sync journey passed, including held B replies, A-only high revision,
lower B update, both cards and persisted reload oracle. Afterwards only
indentation and a unit assertion about safe receipt metadata changed.
node --check on both executable files and node --test test/static-sync.test.mjs
passed4/4. The original full stable FAILED remains unchanged; this is not a
new complete stable audit. Raw addressed results: release checkout
output/issue-1302/ha/{summary.json,commands.log,labs/*/artifacts/results.json}.
Companion task-impact/1302.md records the existing journey change.

## Complete behavior diff (whitespace-only indentation omitted)

```diff
diff --git a/test/static-sync.test.mjs b/test/static-sync.test.mjs
index e98a6a9..219ea88 100644
--- a/test/static-sync.test.mjs
+++ b/test/static-sync.test.mjs
@@ -45,6 +45,10 @@ test('only actual matching GET replies are held; receipts omit complete config p
   } };
   connection.response(reply);
   assert.equal(connection.client.length, 1);
+  assert.deepEqual(wire.receipt().readHoldTarget, {
+    connection: null, types: ['houseplan/config/get', 'houseplan/layout/get'],
+  });
+  assert.equal(JSON.stringify(wire.receipt()).includes('private-fixture'), false);
   assert.deepEqual(wire.counts(), { config: 1, layout: 0 });
   assert.deepEqual(wire.results, [{ connection: 1, type: 'houseplan/config/get', success: true,
     rev: 11, decorAssetsApi: 1, summaryPanelApi: 1 }]);
diff --git a/tests/lib/static-sync.mjs b/tests/lib/static-sync.mjs
index 2954add..b2c30cd 100644
--- a/tests/lib/static-sync.mjs
+++ b/tests/lib/static-sync.mjs
@@ -106,6 +106,7 @@ export class StaticSyncWire {
     throw new Error('House Plan websocket did not settle');
   }
   receipt() { return { connections: this.connections, commands: this.commands, results: this.results, events: this.events,
+    ...(this.readHold ? { readHoldTarget: { connection: this.readHold.connection ?? null, types: [...this.readHold.types] } } : {}),
     heldReads: (this.readHold?.pending ?? []).map(({ connection, type }) => ({ connection, type })),
     heldEvents: (this.eventHold?.pending ?? []).map(({ connection, type }) => ({ connection, type })),
   }; }
@@ -148,8 +149,16 @@ export const firePlanEvent = (type, data) => wsCall({ type: 'fire_event', event_
  */
 export async function ownStaticHosts(page) {
   return page.locator('houseplan-space-card').evaluateAll(all => {
+    if (all.length !== 2) throw new Error('connection handoff requires the original static pair');
     const source = all[0].hass, frames = all.map(host => host.getBoundingClientRect());
-    all.forEach(host => host.remove());
+    // #1302: removing only its card children lets the connected Lovelace
+    // application recreate an A-owned pair on its next HA update. Those
+    // extra cards can claim the shared store while the owned pair adopts B.
+    // Detach the page's application root, preserving its real connection A;
+    // detached descendants cannot rejoin the document. Reload restores HA.
+    const app = document.querySelector('home-assistant');
+    if (!app) throw new Error('static handoff fixture requires the HA application root');
+    app.remove();
     const wrapper = document.createElement('div');
     wrapper.id = 'e2e-static-sync-host-handoff';
     document.body.append(wrapper);
diff --git a/tests/static-sync.admin.spec.mjs b/tests/static-sync.admin.spec.mjs
index 2ca2d66..30ff430 100644
--- a/tests/static-sync.admin.spec.mjs
+++ b/tests/static-sync.admin.spec.mjs
@@ -247,6 +247,7 @@ test('a real virtual-light event paints immediately and survives a layout-only r
 test('held old reads cannot replace newer events, and a real connection handoff drops the old revision high-water', async ({ page }, testInfo) => {
   test.setTimeout(180_000);
   const wire = await staticSyncWire(page);
+  try {
     await openPair(page, wire);
     const before = await painted(page);
     wire.holdReads();
@@ -269,6 +270,7 @@ test('held old reads cannot replace newer events, and a real connection handoff
     expect(await ownStaticHosts(page)).toEqual({ cards: 2, connectionUnchanged: true });
     const owned = ownedStatics(page);
     await openPairReady(page, wire, owned);
+    await expect(statics(page)).toHaveCount(2);
     const afterRace = await painted(page, SOURCE, owned);
     const connectionA = wire.connections, connectionB = connectionA + 1;
     wire.holdReads(undefined, connectionB);
@@ -276,6 +278,7 @@ test('held old reads cannot replace newer events, and a real connection handoff
     expect(await handoffStaticConnection(owned)).toEqual({ cards: 2, authenticated: true });
     await wire.heldReads(2);
     expect(wire.connections).toBe(connectionB);
+    await expect(statics(page)).toHaveCount(2);
     const highWater = (await planLayout()).rev + 100;
     await firePlanEvent('houseplan_layout_updated', { rev: highWater });
     await expect.poll(() => wire.events.some(e => e.connection === connectionA && e.rev === highWater)).toBe(true);
@@ -297,4 +300,7 @@ test('held old reads cannot replace newer events, and a real connection handoff
     await evidence(testInfo, page, 'real-connection-handoff-lower-revision');
     await attachReceipt(testInfo, wire);
     await assertReloadOracle(page, wire, low.position, SOURCE, true);
+  } finally {
+    await attachReceipt(testInfo, wire, 'handoff-finally.json');
+  }
 });
```
