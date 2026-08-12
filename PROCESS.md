# House Plan change provenance

This file is the repository-visible minimum process contract. The detailed
two-agent workflow lives in `.agents/PROTOCOL.md` in the owner's checkout;
contributors and fresh agents must still be able to discover the rules below
from a plain clone.

## Before changing code

Every product, test, documentation or release change must belong to a GitHub
issue in the canonical House Plan Project. Keep scope and acceptance criteria
there; a local spec supports an issue but does not replace it.

## Commit trailers

Every non-merge commit carries:

```text
Issue: #123
User-Visible: yes
```

Use `User-Visible: no` for refactoring, tests, build tooling and documentation
that do not change product behaviour. A commit that changes reviewed golden
baselines additionally carries both:

```text
Release: v1.2.3-beta.1
Baseline-Reviewed: <CI run or artifact reference>
```

Never invent a review reference merely to pass a gate. Baselines are accepted
only from the complete Linux CI artifact via `golden:accept -- --reviewed`.

Install dependencies once per clone; the `prepare` script activates the
repository hook automatically:

```bash
npm install
```

The hook checks message provenance locally; `validate.yml` enforces the same
terminal-trailer contract for every non-merge commit in a push or PR, so
`--no-verify`, rebases and fresh clones cannot bypass it. Test, build and release gates remain
the commands documented in `CONTRIBUTING.md` and `docs/TESTING.md`.

## Release history

Do not rewrite published commits to add missing trailers. Record the gap in an
audit and enforce this contract on future work. Promotion-only stable commits
remain subject to the same Issue/User-Visible trailers.
