# Текст для полей issue (шаблон Feature request)

**Title**

Settings dialogs: new compact card layout (Space, General, Room, Device on the plan)

В форме заполняются только три поля ниже; метки и статус ставит владелец. Архив с прототипом и четыре PNG прикрепить через «Paste, drop, or click to add files».

---

**What problem would this solve?**

The four settings dialogs (Space, General settings, Room settings, Device on the plan) are flat lists of fields: toggles, selects, radio lists, colour swatches and hint paragraphs follow each other in one column with no grouping. Related settings sit far apart, some options are worded as "hide" next to others worded as "show", explanations take whole paragraphs, and the colour picker opens a separate HSB panel with sliders and an OK button. Editing one setting means scanning the whole dialog.

**How do you imagine it working?**

UI-only redesign, no changes to state, storage, resolvers or behaviour. Each dialog becomes a 560 px form with a fixed header and footer and one scrolling body of white cards (Space: Basics, Appearance, Room cards, Sun & light; General: Display, Zigbee links, Room fill colors, Light-source glow, Plan, Sun, Data; Room: Basics, Fill, Sensor sources, Font sizes; Device: Basics, Tap action, Light and glow, Appearance, Details). Shared controls: segmented control instead of selects/radio lists with 2–5 options, one-line rows for uniform toggle lists, icon tiles for the room-card values, inline colour field (swatch with the system picker, hex, opacity, Reset) instead of the HSB popover, colour tiles for colour groups, `hp-help` "?" buttons next to every heading instead of hint paragraphs. Save is enabled only with changes and without errors; closing with unsaved changes asks to keep or discard.

**Scope: UI of the four dialogs only.** No changes to dialog state, config, resolvers, saving, permissions or any product logic; every new control writes the same value to the same key as the control it replaces. Interactive prototype of all four dialogs, full-height screenshots, the detailed spec (`SPEC.md`, in the `## ТЗ` structure from PROCESS.md §7.1) and the implementation guide (`IMPLEMENTATION-GUIDE.md`) are in the attached archive. I can implement it myself once the issue is admitted.
