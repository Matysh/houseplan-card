# User changelog for stable releases

Agent-authored changes since the previous stable release, newest first.
Rules and commands: [DEVELOPMENT.md](DEVELOPMENT.md#agent-authored-stable-notes-and-release-accounting-838840).
Technical history and betas: [CHANGELOG.md](CHANGELOG.md).

The 1.80.1 entry below is the owner's approved style example, translated into
English. It does not rewrite the published release; its historical milestone
collection has not yet been curated under the new rules.

<!-- release: v1.80.1 -->
<!-- base: v1.79.0 -->
## New release - HousePlan 1.80.1

Editing your plan is easier: move walls by dragging their nodes and remove unused spaces without extra steps. Battery levels are now visible on the plan, the Zigbee map is more accurate, and restoring your plans after reinstalling is simpler.

🧱 **Move walls by their nodes.** Drag corners and wall junctions in Select mode. The preview shows the result, and snapping helps line up walls. Changed your mind? Press Esc or undo the change with Undo. [#803](https://github.com/Matysh/houseplan-card/issues/803)

🔋 **Keep an eye on batteries.** See battery levels beside devices and in their tooltips. Show only low-battery warnings or hide indicators for individual devices. [#792](https://github.com/Matysh/houseplan-card/issues/792), [#806](https://github.com/Matysh/houseplan-card/issues/806), [#807](https://github.com/Matysh/houseplan-card/issues/807), [#817](https://github.com/Matysh/houseplan-card/issues/817)

📡 **A Zigbee map without guessed connections.** Connections come from ZHA and Zigbee2MQTT. Zigbee2MQTT scans keep running even after you close the browser — come back for the results later. [#798](https://github.com/Matysh/houseplan-card/issues/798), [#800](https://github.com/Matysh/houseplan-card/issues/800)

🗑️ **Remove a space in one step.** No need to take each device off the plan first. Your devices in Home Assistant stay untouched. [#819](https://github.com/Matysh/houseplan-card/issues/819)

💾 **Reinstall without losing your plans.** HousePlan offers to restore saved data or start fresh. If you choose a clean slate, your previous plans stay in an archive. [#820](https://github.com/Matysh/houseplan-card/issues/820)

Switching floors and resizing rooms is faster on large plans. LED strips cause less slowdown when zooming. We also fixed the room outline during radar setup and device and opening updates in space cards.

[All user-facing changes in this release](https://github.com/Matysh/houseplan-card/issues?q=is%3Aissue%20milestone%3A%221.80.1%22)

<!-- release: v1.79.0 -->
<!-- base: v1.78.0 -->
## New release - HousePlan 1.79.0

Show light right where it belongs: draw an LED strip on the plan and link it to a device. In the evening, the background can show the Moon in its current phase. We also made the plan faster and steadier, with less flicker, fewer unexpected shifts and better editor recovery.

💡 **LED strips on your plan.** Draw a strip point by point, link it to a light and control it from the plan. A soft glow shows where the light is on. Switch between the strip and a regular icon without losing its shape. [#780](https://github.com/Matysh/houseplan-card/issues/780)

🌙 **The Moon in its real phase.** At dusk and night, the background can show a crescent, half or full Moon based on its current phase and position above the horizon. Enable it in General settings under Sun and Moon. [#661](https://github.com/Matysh/houseplan-card/issues/661)

In 2.5D, furniture no longer shifts when switching views, and device icons stay put when their states change. Updates and floor switching are faster, and room fills no longer flicker. Returning to the editor after the card reloads is more reliable; failed loads no longer retry without your action.

[All user-facing changes in this release](https://github.com/Matysh/houseplan-card/issues?q=is%3Aissue%20milestone%3A%221.79.0%22)

<!-- release: v1.78.0 -->
<!-- base: v1.77.0 -->
## New release - HousePlan 1.78.0

Your plan is clearer and easier to use every day. Volumetric view is now in General settings, and stairs connect floors right on the plan. Phones leave more space for your home, card height is adjustable, and you can manage hidden devices as a group.

🧊 **Volumetric view, no experimental settings needed.** Turn on 2.5D in General settings: devices appear as raised tiles with shadows, and light from windows follows the Sun. Flat view stays familiar. [#649](https://github.com/Matysh/houseplan-card/issues/649)

🪜 **Stairs between floors.** Add straight or spiral stairs, set their dimensions and choose where they lead. In View mode, tap the stairs to switch to the linked floor. [#663](https://github.com/Matysh/houseplan-card/issues/663)

🙈 **Hide or bring back devices as a group.** Find hidden devices in the catalogue, select a few or all of them and show them on the plan in one action. You can also hide selected devices together. [#618](https://github.com/Matysh/houseplan-card/issues/618)

📐 **Card height that fits your screen.** On Sections dashboards, use Home Assistant's standard resize handle to make the plan taller or shorter. The plan and editors fit the space you give them. [#648](https://github.com/Matysh/houseplan-card/issues/648)

📱 **More room for the plan on phones.** The toolbar is more compact: everyday actions stay handy, with the rest in a menu. Editor controls no longer take up space for people who only view the plan. [#616](https://github.com/Matysh/houseplan-card/issues/616)

Panning and swiping between spaces no longer compete, and double-tap fits the plan again. Translucent device icons help you line things up in the Plan editor. We fixed number entry, Home Assistant dialogs, large-plan uploads and vacuum route links during import. Virtual lights save their latest changes more reliably when Home Assistant stops.

[All user-facing changes in this release](https://github.com/Matysh/houseplan-card/issues?q=is%3Aissue%20milestone%3A%221.78.0%22)
