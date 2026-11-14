# User-guide screenshots / Скриншоты руководства

These 48 images illustrate the English and Russian user guides: 24 matching
scenes per language. They were captured from the actual House Plan panel and
dialogs built from [dev 45faf4e](https://github.com/Matysh/houseplan-card/tree/45faf4e7c16d5feb2e0f30727784d69a52429960)
(development line 1.85.x, package version 1.85.2) on 14 November 2026.
This is documentation of that development snapshot, not a release announcement.

Все 48 изображений сняты с работающего интерфейса House Plan: по 24 одинаковых
сценария на русском и английском языках. Это вымышленный дом с демонстрационными
устройствами. Пользовательский Home Assistant и его данные не использовались.

- Host: the sidebar panel, with a light Home Assistant theme.
- Browser: Chromium 151.0.7922.34, device scale factor 1, reduced motion.
- Dialogs: the repository's offline fixture loads the unmodified official
  Home Assistant frontend dialog component, pinned to `20260729.7`.
- Typography: Roboto from that same frontend package.
- Icons: the repository's MDI assets, including explicit example device icons.
- Inputs: a localized adaptation of the repository's synthetic visual fixture;
  it uses ordinary saved plan/device data and mock HA responses. No product
  markup, labels or controls were replaced for the pictures.
- Cropping: dialog images show the relevant open surface with a small margin;
  editor images include the plan and Properties column. The colour picker
  includes its open popup. PNG compression is lossless (`oxipng`).
- Images and captions are explanatory examples. Names, readings, selected
  values and exact layout can differ in a real home or another theme/window size.

[Capture record](PROVENANCE.md) records the source revision, build
fingerprint, browser and HA package provenance, language, viewport and SHA-256
of each image. Refresh both languages together when these screens change;
checking that a file exists does not establish that its interface is current.
