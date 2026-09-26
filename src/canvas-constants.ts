/**
 * Dependency-free coordinate constants shared by low-level geometry modules.
 * Keep this leaf free of model/render imports: modules such as stairs are
 * consumed by space-geometry itself and must not form an ESM initialisation
 * cycle through that higher-level facade.
 */
export const NORM_W = 1000;
export const CANVAS_LIMIT = 5000;
export const GRID_N = 240;
export const GRID_PITCH = NORM_W / GRID_N;
export const GRID_STEP_N = 1 / GRID_N;
