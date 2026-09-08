export type SettledSoftStage = {
  headerHeight: number | null;
  size: [number, number];
};

/** Measure the card-owned chrome plus the bounded HA chrome above the card. */
export function measuredCardHeaderHeight(
  root: ParentNode,
  stage: HTMLElement,
  panelHost: boolean,
): number | null {
  const card = root.querySelector<HTMLElement>('ha-card');
  if (!card) return null;
  const cardRect = card.getBoundingClientRect();
  const own = stage.getBoundingClientRect().top - cardRect.top;
  const above = panelHost ? 0 : Math.min(Math.max(cardRect.top, 0), 120);
  const height = Math.round(own + above);
  return height >= 0 ? height : null;
}

/**
 * Stop the passive post-boot height transition synchronously. Camera commands
 * run in the same input event, so they must see the final stage box rather
 * than wait for Lit and ResizeObserver to reconcile it on later frames.
 */
export function settleSoftStageLayout(
  root: ParentNode,
  stage: HTMLElement | null,
  panelHost: boolean,
  kiosk: boolean,
): SettledSoftStage | null {
  if (!stage) return null;
  const headerHeight = measuredCardHeaderHeight(root, stage, panelHost);
  if (!panelHost && !kiosk && headerHeight !== null) {
    stage.style.height = `calc(100dvh - ${headerHeight}px)`;
  }
  stage.classList.remove('hpsettle');
  stage.getBoundingClientRect();
  if (stage.clientWidth <= 0 || stage.clientHeight <= 0) return null;
  return { headerHeight, size: [stage.clientWidth, stage.clientHeight] };
}
