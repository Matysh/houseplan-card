# 🏠 House Plan — a live home map for Home Assistant

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/v/release/Matysh/houseplan-card)](https://github.com/Matysh/houseplan-card/releases)
[![CI](https://github.com/Matysh/houseplan-card/actions/workflows/validate.yml/badge.svg)](https://github.com/Matysh/houseplan-card/actions)
[![Live demo](https://img.shields.io/badge/demo-try_it_live-00c853?logo=homeassistant&logoColor=white)](https://demo.houseplan.tech)
[![Telegram chat](https://img.shields.io/badge/Telegram-chat-2CA5E0?logo=telegram&logoColor=white)](https://t.me/ha_houseplan)

📘 **[Full user guide](docs/USER-GUIDE.md)** · 🇷🇺 **[Русский](README.ru.md)** · 🗂 **[Project issues](https://github.com/Matysh/houseplan-card/issues)**

<!-- docs-section: overview -->

## Your whole home at a glance

House Plan turns Home Assistant into a live map of your home. Upload a plan or
draw rooms directly on the dashboard, bind them to Home Assistant areas, and
the area's devices appear automatically. You can immediately see where a light
is on, a door is open, a room is too cold, Zigbee signal is weak, or a leak
sensor has fired.

![Synthetic home in View mode with rooms, devices, light and climate](docs/images/01-view-desktop.png)

Setup is entirely graphical: no floor-plan YAML, Inkscape, or external editor.
Plan data and device positions live on the Home Assistant server and stay in
sync across screens.

> **Edit on a desktop computer.** View and kiosk are fully supported on phones
> and tablets. The editors are designed primarily for a mouse and keyboard;
> individual touch editing operations may be awkward or unavailable. See the
> exact [touch support contract](docs/TOUCH-SUPPORT.md).

<!-- docs-section: features -->

## What House Plan provides

- **Live state and safe actions.** Lights and other safe devices can toggle from
  the plan; a lock cannot be opened by an accidental plan tap.
- **Three built-in editors.** Plan creates rooms, walls and openings; Device
  places and configures markers; Background adds lines, labels and furniture.
- **Area-aware rooms.** New devices appear automatically, while room cards can
  show temperature, humidity, light state and average LQI.
- **Light and environment.** Room fills, lamp Glow, wall shadows, a day-cycle
  backdrop and sunlight through windows.
- **Doors, windows, gates and vacuums.** Openings follow real contacts and locks;
  a robot can show its position, dock and travelled path.
- **Several floors and screens.** Space tabs, swipe navigation, local viewport,
  and a separate initial floor for each card.
- **Wall-display kiosk.** A plan-only view with fullscreen navigation and icon
  sizes saved for that display.

![The same synthetic home in touch View mode](docs/images/02-view-touch.png)

<!-- docs-section: first-run -->

## Your first working room

1. Install the integration and add the card to a dashboard.
2. Create the first **space**: upload SVG/PNG/JPG/WebP, reuse an uploaded image,
   or choose no image and draw the plan by hand.
3. In Plan, select **Room outline**, place vertices, and click the first point to
   close the outline.
4. Name the room and bind it to a Home Assistant area. Use “No area” for a room
   that has no devices.
5. Open Device: devices from the bound area are already placed; drag their
   markers to the correct positions.
6. Optionally use Background for lines, text and furniture.
7. Return to View. The plan now displays live state and accepts safe actions.

![Creating the first space](docs/images/03-space-create.png)

![Closing a room outline on its first point](docs/images/04-room-contour-close.png)

![A selected partition and the Plan context tray](docs/images/05-plan-context-tray.png)

![Device settings with binding provenance and the exact action result](docs/images/06-device-editor.png)

![Live presentation preview for the same device](docs/images/06-device-display-preview.png)

Every workflow and edge case is in the [full user guide](docs/USER-GUIDE.md).
The [Background editor contract](docs/DECOR-EDITOR.md) and
[vacuum guide](docs/VACUUM.md) are the authorities for those subsystems.

<!-- docs-section: installation -->

## Installation

### HACS

[![Open the repository in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Matysh&repository=houseplan-card&category=integration)

1. In HACS open **⋮ → Custom repositories**.
2. Add `https://github.com/Matysh/houseplan-card` as an **Integration**.
3. Install House Plan and restart Home Assistant.
4. Open **Settings → Devices & services → Add integration → House Plan**.

The card is registered automatically. If you manage Lovelace resources
manually, use the URL served by the integration:

```yaml
resources:
  - url: /houseplan_files/houseplan-card.js
    type: module
```

Do not use the on-disk path inside `custom_components`; Home Assistant does not
serve that path as a JavaScript module.

### Manual installation

Copy `custom_components/houseplan` to `config/custom_components`, restart Home
Assistant, and add the House Plan integration.

### Add the card

Create a dashboard view (Panel works best) and add the card in the UI or as:

```yaml
type: custom:houseplan-card
title: House plan
```

Different screens may start on different spaces:

```yaml
type: custom:houseplan-card
default_floor: ground
```

All cards share server-side rooms and coordinates. Current mode, viewport and
selected space remain local to the screen. Revision checks and live sync cover
concurrent clients, but avoid editing the same object in two browsers at once.

## Detailed documentation

- [Full user guide](docs/USER-GUIDE.md)
- [Mouse/touch/keyboard matrix](docs/USER-GUIDE.md#6-navigation-zoom-and-input)
- [Plan tools](docs/USER-GUIDE.md#plan-tools-at-a-glance)
- [Background editor](docs/DECOR-EDITOR.md)
- [Robot vacuums](docs/VACUUM.md)
- [Touch support](docs/TOUCH-SUPPORT.md)

<!-- docs-section: support -->

## Support and feedback

- Questions and plan examples: [Telegram @ha_houseplan](https://t.me/ha_houseplan).
- Bugs and proposals: [GitHub Issues](https://github.com/Matysh/houseplan-card/issues).
- Before reporting, update House Plan, restart HA and hard-refresh the page.
  Include the version, browser, logs and reproduction steps; private entity IDs
  may be replaced with fictional ones.

Documentation screenshots are produced by the reproducible
`npm run build && node demo/docs/capture.mjs` command using synthetic data only. Scenario version,
source fingerprint and every image hash are recorded in the
[screenshot index](docs/images/screenshots.json).

License: [MIT](LICENSE).
