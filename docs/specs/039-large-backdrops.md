# ТЗ #39 — Безопасная работа с большими подложками

- Issue: https://github.com/Matysh/houseplan-card/issues/39
- Приоритет: P2
- Статус ТЗ: research-first, thresholds утверждаются по benchmark

## Цель

До upload предупреждать о raster, способном исчерпать память tablet/WebView,
и предлагать уменьшенную копию без потери текущего плана при ошибке.

## Локальная диагностика

Для PNG/JPEG/WebP до сетевого запроса:

- MIME/signature и file bytes;
- decoded width×height через `createImageBitmap`, fallback isolated `<img>`;
- megapixels и minimum decoded RGBA memory `w*h*4`;
- estimated working peak: bitmap + canvas + encoded output (conservative 2.5×);
- рекомендуемый target dimensions.

Object URLs всегда revoke; decode timeout/error не заменяет текущий backdrop.
SVG получает file-size/security validation, но не raster memory/downscale.

## Threshold protocol

Перед code default провести matrix на reference low-end wall tablet WebView и
desktop Chromium: 4/8/16/32/64 MP, transparency, JPEG/WebP. Ship constants
документируются как `WARN_DECODED_BYTES` и `MAX_SAFE_DIMENSION`. Рекомендуемый
начальный guard для исследования: warning при >32 MP либо estimated peak
>128 MiB; это не становится product constant без результатов.

## UX

- Safe: обычный upload.
- Warning: dialog показывает resolution, file size, estimated memory и действия
  «Загрузить уменьшенную копию», «Оставить оригинал», Cancel.
- Hard browser limit/decode failure: только Cancel и инструкция уменьшить файл
  desktop tool; нельзя продолжать blind.
- Downscale сохраняет aspect; longest side до benchmark target. PNG с alpha
  остаётся PNG, opaque photo — JPEG/WebP с documented quality; metadata не
  требуется.

## Transaction

Existing backdrop/config остаются до успешного upload+validation+config save.
Downscaled Blob проходит тот же quota/copy-on-write backend path. При upload,
save или decode failure staging очищается, старый ref не удаляется. Undo и
explicit plan deletion работают как сейчас.

## Проверки и приёмка

- header fixtures без выделения гигантского canvas до warning;
- alpha/aspect/orientation (EXIF), corrupt/truncated, decode timeout;
- failed upload/save preserves previous plan and files;
- memory benchmark report + documented thresholds;
- mobile dialog без horizontal scroll;
- SVG никогда автоматически не растеризуется.
