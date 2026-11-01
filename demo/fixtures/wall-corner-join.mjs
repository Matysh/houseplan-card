/** Independent generated witness for #1169; no owner geometry or copied report coordinates. */
export function wallCornerJoinSpace() {
  return {
    id: 'synthetic-corner', title: 'Synthetic corner', cell_cm: 1,
    rooms: [], wall_segments: [], wall_columns: [],
    partitions: [
      { id: 'corner-a', a: [.45, -.38], b: [.137, .083], cm: 15 },
      { id: 'corner-b', a: [.137, .083], b: [.83, -.13], cm: 15 },
    ],
    settings: { show_borders: true, wall_fill: { c: '#ffffff', a: 1 },
      fill_mode: 'custom', custom_fill: { c: '#607d8b', a: 0 } },
  };
}