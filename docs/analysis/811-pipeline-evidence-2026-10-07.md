# Issue #811: parser audit and screenshot-acceptance evidence

One-time analysis evidence for [#811](https://github.com/Matysh/houseplan-card/issues/811),
2026-10-07. The issue body is the canonical spec; this is not a parallel backlog.
Base: `20b69d872c0f61a1d946b22385c031461cfec2d6`. Execution: WSL Ubuntu,
Node 22.23.2. No product code, screenshots or generated review index are changed
by this task. F6 was already fixed by #810; F30 requires an audit, not an assumed
pixel-comparator fix.

## AC4: all current review documents

The old parser at the base and the new parser were run against the same complete
`docs/reviews` catalogue: **343 → 343** documents; **0 → 0** skipped.
The legacy archive is still not traversed. All verdicts, High/Medium counts,
metadata and record ordering are unchanged. **339 records are byte-for-byte
identical as structured data**; four records differ only as listed below.

| Document | Before | After and reason |
|---|---|---|
| `CODE-REVIEW-642-r2.md`, findings | 4 headings | 2: «Что именно принёс второй ребейз (до 7bb55c2a) — не заявление, а diff»; «Полный построчный разбор диффа origin/dev...HEAD (72 файла)». The existing own-round section filter excludes «Идентичность дерева коду, который уже разобрал r1» and «Гейты — что унаследовано, что перепрогнано лично на этом SHA». |
| `CODE-REVIEW-642-r3.md`, findings | 3 headings | 1: «Что именно принёс третий ребейз — не заявление, а diff». The same filter excludes «Идентичность дерева коду, который разобрали r1 и r2» and «Гейты — что унаследовано из Validate CI на этом точном SHA, что перепрогнано лично». |
| `CODE-REVIEW-657-r2.md`, findings | `["из r1 — проверка закрытия"]` | `[]`: a closed finding from r1 is not a new finding. |
| `CODE-REVIEW-657-r2.md`, files | `scripts/merge-candidate.mjs`, `PROCESS.md`, `mutation-registry.mjs`, `INDEX.md` | `[]`: all four paths belonged to that same closed r1 finding. |
| `SPEC-REVIEW-662-r3.md`, findings | `[]` | Two actual Medium headings: «радиус по умолчанию: ТЗ дизайнера противоречит решению 12, расхождение не названо»; «AC14 и раздел «Скоуп» называют документы, удалённые #679». |
| `SPEC-REVIEW-662-r3.md`, files | `[]` | The first eight paths from those findings, preserving the existing cap: `TZ-issue-662-LED-strips.md`, `docs/design/662-led-strips/TZ-issue-662-LED-strips.md`, `docs/design/662-led-strips/README.md`, `docs/TESTING-DEMO.md`, `docs/reviews/CODE-REVIEW-679-r1.md`, `LIGHT.md`, `DEVICE-LIGHT-SETTINGS-MATRIX.ru.md`, `TESTING-DEMO.md`. |

The own-round heuristic itself is not broadened here; it is now applied
consistently to findings/files and every count fallback. Unknown historical
verdicts, including the ambiguous #239-r2/#43-r2 fixtures, remain `—`.
The real #403-r2 does not inherit High:1 from r1; #662-r3 keeps Medium:2.

The actual CLI was run on a temporary copy of all 343 documents:

```sh
node scripts/reviews-index.mjs --dir=<copy> --output=<copy>/INDEX.md --strict
# Repeat the same generation, then:
node scripts/reviews-index.mjs --dir=<copy> --output=<copy>/INDEX.md --strict --check
```

All three commands exited 0. Both generations were identical; output SHA-256:
`fed0e855105c86d5bfc8c8b82b8e484c982f32cf5aa4c1ef2ba7d77e5500eb02`.
The checkout's `docs/reviews/INDEX.md` was not regenerated.

## AC5: trust boundary and first-merge bootstrap

The dev-snapshot controller retains merge policy, CI proof, staging, committing
and pushing. The candidate contributes only its already-reviewed generator and
tracked input tree. A temporary export excludes credentials, `.git`, untracked
files and symlinks. The Node permission model limits accidental filesystem and
child-process effects; it is **not** a security sandbox for malicious code
([Node 22 documentation](https://nodejs.org/docs/latest-v22.x/api/permissions.html#permissions)).
The generator is not run if a rebase changes patch-id and requires another review.
An index-only commit is part of the exact candidate SHA checked before a rebased
candidate can be pushed to dev. The real-git tests cover both fast-forward and
rebased paths, including a concurrent review document and a changed generator.

Bootstrap limitation: the first integration of #811 is itself controlled by the
previous dev snapshot. That old controller may generate one final index with
the old parser. The new implementation cannot retroactively replace the running
controller. After automatic integration, check `reviews-index --check` on dev.
If stale, restore the task branch at that accepted SHA without authoring an
index commit and return the same issue through S6/S7: the new trusted controller
can reuse the green review for an unchanged non-review tree and generate the
index at integration. Any non-review dev drift disables reuse normally.
The index-only push does not run Validate (`paths-ignore`), so verify the repaired
exact dev SHA with `reviews-index --check` separately. Do not hand-merge, generate
the index on the issue branch or push implementation directly to dev.

## AC8 / F30: what the repository proves

1. [ab9dc1fb](https://github.com/Matysh/houseplan-card/commit/ab9dc1fb46cbec5468bc8727f989843462907f06)
   adds the per-device battery opt-out (#806), including the device-dialog row.
2. [e49083d6](https://github.com/Matysh/houseplan-card/commit/e49083d6ec136fde797d3414774ca36a898bd704)
   is the beta.6 candidate. Its `docs/images` diff changes only
   `screenshots.json`: the global fingerprint and all eleven scenario source
   hashes change; PNG files and `imageSha256` values do not. The previous
   acceptance trace remains, with `lastWriteWasFingerprintOnly: true` and
   `identicalPixels: true`. The commit message says the refresh was pixel-identical.
3. [Derived artifacts run 37566155906](https://github.com/Matysh/houseplan-card/actions/runs/37566155906)
   is a failed beta.7 run on `24e48935c3b2d7887a41c544d062a6ea78ed13d6`.
   The supplied F30 report records an undeclared change of
   `device-display-preview`. That message is evidence from the supplied report;
   the current `gh run view --log` response did not expose its log text.
4. [150b5a16](https://github.com/Matysh/houseplan-card/commit/150b5a166b3d01c07976fc1fd9231deef37a34f7)
   accepts the beta.7 derived artifact from
   [run 37573076137](https://github.com/Matysh/houseplan-card/actions/runs/37573076137).
   Only `06-device-display-preview.png` and the manifest change; the commit
   explicitly names that changed frame. The PNG is already corrected.

This proves an inconsistent beta.6 fingerprint-only artifact, not which command
or capture input produced it. Git does not record the invocation or candidate
pixels; the original beta.6 capture/acceptance log is not established here.
Calling the route non-canonical is therefore a hypothesis, **not a proven root
cause or a demonstrated defect in `--identical`**. No screenshot or comparator
change is justified by the available evidence.

The existing canonical-path witnesses were re-run rather than duplicated:

```sh
node --test test/docs-accept.test.mjs test/png-identical.test.mjs
```

Result: **23/23 pass, no skips**. In particular:

- `#512 AC3: one differing pixel refuses, names the frame and leaves everything
  committed as it was` exercises the production `acceptIdentical` path: one
  changed pixel rejects and preserves PNG bytes and the entire previous manifest.
- `#512 AC3: identical frames accept only the source fingerprint; bytes and
  provenance stay committed` proves unchanged frames keep PNG bytes and the
  acceptance trace while advancing only the permitted fingerprint fields.
- `#421 fingerprint-only refresh preserves the complete previous acceptance
  trace` independently checks the trace-preservation contract; PNG unit tests
  cover alpha, dimensions and per-frame identity.

## Negative witnesses before implementation

- AC1: the actual Git DAG through `resolveValidationRange` →
  `process-gate --github-range` falsely included closed #807 before the fix;
  an own closed-issue commit still rejects after it.
- AC2–4: new parser cases produced 17 pass / 16 fail (including subtests) on the
  old parser; the corrected full file produced 33/33 pass.
- AC5: the two real-git candidate-generator tests both failed with the old
  adjacent-dev-generator invocation, and pass with accepted-tree generation.
  A separate negative probe showed inherited `GIT_DIR`/`GIT_WORK_TREE` selecting
  a neighbouring repository instead of the explicit candidate cwd; clearing
  inherited Git overrides changed that same test from red to green.
- AC6–7: before the change, 2/6 new CLI/git cases passed and four failed:
  wrong category count accepted, numeric conflict aborted, a clean merge left
  stale counts, and a clean merge introduced a duplicate ID without refusal.
  The existing warning and manual-conflict contracts were already passing.
  Three later probes also failed before their guards: a malformed ID bullet
  could disappear from counts, and original/dev-introduced inventory symlinks
  could direct writes outside the checkout. All three now reject while
  preserving the original tree and external sentinel bytes.

These are ordinary negative test cases, not mutation-suite execution. The
mutation registry is checked statically only (`mutation-gate --check`, §2.9).
