/** UI Kit motion. Scene geometry keeps its own timelines and shapes. */
export const controlMotion = {
  paint: { duration: 160, easing: 'ease' },
  appear: { duration: 180, easing: 'ease-out' },
  leave: { duration: 140, easing: 'ease' },
  disclosure: { duration: 220, easing: 'cubic-bezier(.2,0,.2,1)' },
  spin: { duration: 1000, easing: 'linear' },
  pulse: { duration: 1200, easing: 'ease-in-out' },
} as const;

export function controlMotionReduced(view: Pick<Window, 'matchMedia'> | null = globalThis.window ?? null): boolean {
  return view?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Individual translate leaves the caller's positional transform intact. */
export function controlSurfaceFrames(appearing: boolean, current?: Pick<CSSStyleDeclaration, 'opacity' | 'translate'>): Keyframe[] {
  const position = current ? { translate: current.translate } : {};
  return appearing
    ? [{ opacity: current?.opacity ?? 0, translate: current?.translate ?? '0 -10px' }, { opacity: 1, translate: '0 0' }]
    : [{ ...position, opacity: current?.opacity ?? 1 }, { ...position, opacity: 0 }];
}
