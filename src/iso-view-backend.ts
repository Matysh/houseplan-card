export type ViewBackend = 'flat' | '2.5d' | 'real-3d';
export type ViewProjection = 'flat' | 'iso';

export interface ViewBackendInput {
  surface: 'view' | 'editor' | 'static';
  showBorders: boolean;
  fallbackRequested: boolean;
  real3dRequested: boolean;
  /** The respective backend has a complete frame for the current plan. */
  fallbackReady: boolean;
  real3dReady: boolean;
}

export interface ViewBackendChoice {
  requested: ViewBackend;
  presented: ViewBackend;
  projection: ViewProjection;
}

/**
 * 2.5D and Real 3D share an isometric camera but not readiness or their
 * preferences. A previously painted frame never proves the next one ready.
 */
export function resolveViewBackend(input: ViewBackendInput): ViewBackendChoice {
  if (input.surface !== 'view' || !input.showBorders) {
    return { requested: 'flat', presented: 'flat', projection: 'flat' };
  }
  const requested = input.real3dRequested ? 'real-3d' : input.fallbackRequested ? '2.5d' : 'flat';
  const presented = input.real3dRequested && input.real3dReady ? 'real-3d'
    : input.fallbackRequested && input.fallbackReady ? '2.5d' : 'flat';
  return { requested, presented, projection: presented === 'flat' ? 'flat' : 'iso' };
}
