# ТЗ #51 — Пользовательские изображения в декоративном слое

- Issue: https://github.com/Matysh/houseplan-card/issues/51
- Приоритет: P2
- Статус ТЗ: draft, security dependencies обязательны
- Зависимости: color/CSS audit #21; large raster pipeline #39

## Цель

Размещать PNG/JPEG/WebP/SVG как decor element с теми же move/resize/rotate,
opacity, layer order и per-space lifecycle, что у остальных объектов.

## Модель

```ts
type ImageDecor = {
  id: string; kind: 'image'; asset_id: string;
  x: number; y: number; w: number; h: number;
  angle?: number; opacity?: number;
  preserve_aspect?: boolean;
};
```

Config хранит stable opaque `asset_id`, не signed URL. Render запрашивает
короткоживущий same-origin content URL существующим signer. Asset metadata
backend: id, sanitized original name, MIME, bytes, width/height для raster,
sha256, created/owner space. Blob не в config/layout.

## Storage и transaction

- Новый decor asset namespace под существующим House Plan content root;
- admin/write permission, streaming limit default 2 MiB после преобразования;
- upload staging → validate/sanitize → promote только при successful config save;
- отменённый dialog/failed save очищает staging; referenced asset не удаляется;
- explicit element delete предлагает удалить unreferenced asset; shared refs
  считаются, inference/age deletion запрещены;
- HA backup включает content folder автоматически.

## Raster

PNG/JPEG/WebP проходит #39 diagnostics. Oversized source downscale до safe
target; existing plan/config не меняется до success. EXIF orientation
нормализуется. Initial `w/h` сохраняют aspect и разумный размер относительно
current view; пользователь может снять preserve-aspect в properties.

## SVG security

Не использовать regex sanitizer. XML parser запрещает DTD/entities, удаляет
`script`, `foreignObject`, animation, event attributes, external/data URLs,
`style` с unsafe constructs и неизвестные namespaces; локальные paint/geometry
элементы allowlisted. После sanitization файл повторно парсится, сериализуется
и обслуживается с `image/svg+xml`, `nosniff`, CSP sandbox. При невозможности
гарантировать sanitizer SVG отклоняется, а не сохраняется как есть.

## Editor UX

- Background → Image → выбрать файл → preview → клик по плану;
- selection frame/handles/context tray общие с rect/furniture;
- double-click properties: replace asset, opacity, aspect lock, numeric size,
  angle, layer actions;
- replace transactional и не удаляет старый asset до successful save;
- missing asset показывает bounded placeholder и repair action, не broken icon.

## Export/import и lifecycle

JSON export #50 перечисляет asset в manifest, но не переносит bytes. Будущий
portable asset bundle использует stable id remap. Space/delete cleanup только
явный и reference-aware.

## Проверки и приёмка

- all MIME signatures, spoofed extension, size/quota, corrupt and SVG corpus;
- staging promote/rollback, shared references, delete/replace/reload;
- transforms, undo/redo, copy/paste/optimization and unbounded canvas;
- no external request/script/style breakout from SVG;
- mobile View renders image; touch editing best-effort documented.
