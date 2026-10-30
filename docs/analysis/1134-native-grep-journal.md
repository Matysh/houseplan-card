# #1134: native rejection can precede PreToolUse

## Historical evidence stays refused

Both downloaded diagnostic ZIPs match the original hashes:

| Run / artifact | Verified ZIP SHA256 |
|---|---|
| 40963254444 / 12937885155 | 9de7fcf0abbc15f3ca9c32ee08d381ea4dcd99324caf5cc000f7c4813ffbc76f |
| 40973915476 / 12941269556 | 5736243a7ae3efdd8c11851761f666bc34eb7aa0f6c9e2abeaa8127a1984a1f5 |

They lack result error categories and original input values. Neither old missing
journal can be retrospectively reclassified as a nonexecuting schema rejection
or admitted. Published historical verdicts/certificates are unchanged.

## Provider-free reproduction

Linux native CLI2.1.295, from its published native npm package, matches the
existing workflow checksum exactly:
`4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358`.
The version's published sdk-tools.d.ts declares `-n` boolean and canonical
output_mode values; absence of `-v`/`-l` in types alone proves no runtime order.

The manual `scripts/review-inert-grep-probe.mjs` runs in an isolated Linux network
namespace, refuses a normal networked host, verifies the pin and creates its own
temporary Git repository/HOME. It uses the unchanged real prepare/hook and two
scripted loopback HTTP responses per case, with a synthetic API key only. No real
provider/model is called. Production model/budgets/pin/settings are not changed.

```sh
unshare -Urn sh -c 'ip link set lo up && node scripts/review-inert-grep-probe.mjs --cli=/absolute/path/to/pinned/claude'
```

| Inert input | Observed native result | Real hook rows | CLI terminal |
|---|---|---|---|
| pattern/path/output_mode=content | non-error | 1 allowed | success |
| same plus `-v:true` | InputValidationError, is_error=true | 0 | success |
| pattern/path, `-n:true`, `-l:true` | non-error | 1 allowed | success |
| same but `-n:"yes"` | InputValidationError, is_error=true | 0 | success |

The probe asserts these outcomes. This proves a pre-hook rejection mechanism
and why key names alone do not establish cause: the valid compatibility case
reaches the hook while an invalid type does not. It is consistent with the old
symptom, but cannot recover old values or prove each historical call's cause.
Fake exchange success is diagnostic, never CODE authority.

## Repair: observation, not an exemption

Failure certificates now retain bounded per-result shape, the actual boolean
is_error when present, and fixed categories: input-validation-error-reported,
tool-error-reported, non-error-reported, unknown. Only a leading known envelope
matches; an arbitrary mention in another error does not. No result text, paths,
prompts, argument values or payloads are copied. Missing/malformed/duplicate
results remain explicit; excess metadata is bounded and counted.

These REPORTED categories prove neither execution nor nonexecution. traceProblems,
admission, journal cardinality, material/report/result binding and sealing are
unchanged. A missing Grep journal still refuses even with InputValidationError;
ordinary negative fixtures execute the original audit and verify that refusal.
The catalogue reminds the reviewer to use native JSON schema/canonical
output_mode, without a new capability, model setting or budget change.
