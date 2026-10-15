/** Screen surfaces and native fields own input before any scene gesture path. */
const SURFACE_OWNER = [
  '[data-scene-surface]', 'hp-dialog', '.editor-secondary', '.summary-overlay',
  '.summary-control', '.recoveryoverlay',
  'input', 'textarea', 'select', '[contenteditable]:not([contenteditable="false"])',
].join(',');

export function sceneGestureFromPath(path: readonly unknown[]): boolean {
  return !path.some((entry) => {
    const node = entry as { matches?: (selector: string) => boolean } | null;
    return typeof node?.matches === 'function' && node.matches(SURFACE_OWNER);
  });
}

export type SurfacePoint = { x: number; y: number };

/** Coordinates are CSS pixels relative to the stage's padding box. */
export function clampSurfacePosition(
  position: SurfacePoint, surface: { width: number; height: number },
  stage: { width: number; height: number },
): SurfacePoint {
  const inset = 8;
  return {
    x: Math.max(inset, Math.min(position.x, stage.width - surface.width - inset)),
    y: Math.max(inset, Math.min(position.y, stage.height - surface.height - inset)),
  };
}
