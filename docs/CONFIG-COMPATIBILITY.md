# Config compatibility registry

House Plan accepts some fields that are no longer written by the current UI.
They are not all equivalent: some preserve an old visual exactly, some are
losslessly migrated on an explicit edit, some are immediately discarded by
backend validation, and a small number still need a product decision.

The machine-readable source of truth is
`scripts/config-field-registry.mjs`. Every entry records:

- persisted path and type;
- inheritance level and default;
- whether the current UI exposes it;
- the runtime consumer (or the fact that no supported consumer was found);
- migration behaviour;
- the read-compatibility decision.

This registry initially covers the known compatibility and internal-field debt
identified by HP-DATA-01. It is not yet the complete canonical schema. The next
stage is to register all current public fields and add automated parity against
the TypeScript model and backend Voluptuous validation.

## Offline inventory

Exported JSON can be inspected without uploading it or changing it:

```bash
npm run audit:config -- path/to/houseplan-config.json
npm run audit:config -- --json path/to/houseplan-config.json > findings.json
```

The auditor accepts either the config object itself or an export wrapper with a
top-level `config` object. It reports only fields known to the registry, shows at
most three example paths in human-readable mode and always exits read-only. With
no file it prints the current registry.

## Status meanings

| Status | Meaning |
|---|---|
| `decision-required` | Preserve the field until its supported UI/runtime fate is explicitly decided |
| `deprecated-read` | Current writes use another representation; reads preserve old data/visuals |
| `migrate-on-write` | A lossless current representation is materialised during the documented write path |
| `migrate-on-settings-save` | Removed from current settings semantics and dropped only when those settings are explicitly saved |
| `drop-on-validation` | A stale client may submit it, but backend validation removes it safely |

Unknown future fields remain outside this report and continue to follow the
backend's forward-compatibility policy. Absence from the report is therefore
not permission to delete a field.

## Independent Glow compatibility

The historical space and room token `fill_mode: glow` remains accepted on read
indefinitely. Runtime projects it into an ordinary inherited data fill plus an
enabled Glow overlay; explicit `glow_enabled` / room `glow` booleans always win.
A normal edit that replaces the legacy token writes the resolved boolean in the
same operation. Optimize Plans applies the same lossless, idempotent model-v6
migration while preserving unknown sibling settings.

Current `fill_mode` additionally accepts `custom`. Its optional color is stored
as `{c:'#RRGGBB',a:0..1}` in `space.settings.custom_fill` and, for an explicit
room override, `room.settings.custom_fill`. Missing or invalid historical data
is projected at render time through room → space → `#607d8b`/`0.18`; merely
reading it never rewrites the config. Backend writes keep the strict shared
hex/finite-alpha contract.
