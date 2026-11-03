# #1226: full-card title contract

The old title assertion in smoke_mobile_view_header.mjs conflicts with accepted
[#1207](https://github.com/Matysh/houseplan-card/issues/1207), S8 at
e0b0889c95420f8c05fc3f95762f0e03f390885b. No new Masonry decision is needed.

UI-018 removes the heading from the full dashboard card generally and from its
overflow measurement. UI-019 separately concerns the Sections shell. The
accepted UI-017/018 clarification retains title as the PDF setting. Pinned design
5529ab77c479c6d373fcd3e605574871e5093b3e states the same distinction in
CONTRACT.md and maps it to the common header/measurement in IMPLEMENTATION.md.
Source e1b7a0abf removed the common heading without a layout condition and
renamed editor.title to PDF title in every language. src/editor.ts retains the
field; _renderPdfDialog passes config.title as cardTitle.

Guide3148/3160 is section18 for the separate static houseplan-space-card. That
card's title contract remains valid. The stale generic paragraph is near3834
under #1184; the current paragraph near15 already describes UI-018 correctly.
Neither the guide nor static-card product code is changed by this port.

The smoke now requires title absence at every original width, with a long
configured title, in en/ru and for the read-only role. It verifies that config
retains the title and opens the real PDF dialog through its native button to
check public context.cardTitle, then closes the native footer. No fake PDF
runtime or private state mutation is added.

All original checks remain:44px controls, overflow/containment, phase ordering,
stage height, touch editor transitions, hidden-device action, independent
neighbor width, role permissions and kiosk. Only this classification case was
changed; deep equality preserved the other77 rows. The root combined audit was
not rewritten and other #1226 blockers remain.

Base:04be8ffeae4f9c95a136c5f57c39f2b8c4f40543.
Bundle:9a98f81ace1c07009cf04e016d37cd0b937259f5d067f7f63c28d9f0c6f5c594.

Validation:

- node --check demo/smoke_mobile_view_header.mjs: PASS.
- Initial changed smoke reached PDF, but a new generic cancel observer matched
  footer and close. Log:output/issue1226/header-title-addressed.log.
- After scoping that observer to the native footer, one full changed smoke run
  passed with exit0 (~5.3s). Command:node demo/smoke_mobile_view_header.mjs.
  Log:output/issue1226/header-title-addressed-r2.log.
- Measurements/screenshots:artifacts/header-shared-1184/.

Existing bundle freshness checks passed. No rebuild, other passing-suite
repetition, HA audit or visual-baseline acceptance was performed.
