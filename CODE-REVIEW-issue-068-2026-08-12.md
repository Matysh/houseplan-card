# Code review — issue #68 (contextual help)

Date: 2026-08-12

Branch: `dev`

Scope: `hp-help`, Houseplan help factory, localization contract, dialog/overlay lifecycle,
keyboard and touch interaction, responsive placement, consumers and regression coverage.

## Outcome

The overlay, focus, Escape, outside-click, scroll, Popover/fallback and visual-viewport
paths are internally consistent. The shared dialog overlay registry is used correctly,
the trigger remains reachable in disabled fieldsets through `legend`, and all seven
current call sites have non-empty RU/EN body and ARIA strings.

Four hardening findings were accepted and fixed locally. No model, saved configuration
or user data contract changed.

## Findings and resolutions

### CR68-01 — dead trigger is rendered without help content (P1)

`hp-help` blocked `_openHelp()` when `text` was empty, but `render()` still returned a
focusable button. The result was the exact reported defect: a visible help glyph that
could not open any explanation.

Resolution: `hp-help` renders nothing unless both trimmed `text` and `ariaLabel` exist.
The same predicate guards opening and closes an already-open surface if either value is
removed dynamically.

### CR68-02 — missing translation could be displayed as a key (P1)

The card factory called `t()` directly. Its intended generic fallback returns the key
name when neither dictionary contains a value, so a future incomplete help pair could
produce a real trigger with implementation text such as `marker.foo.help`.

Resolution: the factory now checks the localized value and its derived `.aria` value
through `hasTranslation()` before it creates `hp-help`. English fallback remains valid;
a genuinely absent or whitespace-only pair produces no host and no layout gap.

### CR68-03 — accessible name had a hard-coded English fallback (P1)

Direct use without `ariaLabel` produced `aria-label="Help"`. This violated the issue
contract requiring a complete localized accessible name and made an incomplete component
look valid to keyboard and screen-reader users.

Resolution: the fallback was removed. Missing ARIA copy suppresses the affordance just
like missing visible copy.

### CR68-04 — icon did not follow the product icon system (P2)

The trigger used a font `?`, whose shape and optical alignment depended on the platform
font and did not visually mean “question in a circle”.

Resolution: the glyph is now the shared MDI `help-circle-outline` vector inside the same
32/40 px target. It remains decorative because the button already has a full ARIA label.

### CR68-05 — regression coverage missed incomplete content (P2)

The smoke covered all open/close and overlay paths but never instantiated an empty or
half-configured component, so CR68-01/03 could pass the release gate.

Resolution: the #68 smoke now asserts that empty body and empty ARIA copy create no
trigger, and that restoring a complete pair creates the circled-question SVG.

## Reviewed without changes

- Mouse hover timing, keyboard focus, touch click and the second-Escape dialog path.
- `aria-describedby` only while open; the visible bubble stays hidden from the
  accessibility tree to avoid duplicate announcements.
- Exclusive transient-surface ownership with the colour/opacity picker and toast.
- Popover API path and dialog-owned fallback portal.
- Cached dialog scroll-listener cleanup and disconnect cleanup.
- Visual viewport placement, flipping and edge clamping.
- Existing call sites and RU/EN localization parity.

## Verification policy

Per project policy, no tests were run during this local edit. Static type checking,
syntax checking and whitespace validation are recorded in the handoff; the updated
targeted smoke is intended for the next prerelease gate.
