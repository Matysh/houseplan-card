/** Exact three-wall coordinates from public #1076; unrelated settings omitted. */
export function smoothWallSeamSpace() {
  const points = [
    [-0.1, 0.14166666666666666],
    [-0.07916666666666666, 0.5166666666666667],
    [0.15, 1.5583333333333333],
    [-0.6208333333333333, 1.5166666666666666],
  ];
  return {
    id: 'smooth-wall', title: 'Smooth wall', cell_cm: 1,
    view_box: [0, 0, 1, 1], rooms: [], wall_segments: [], markers: [],
    partitions: points.slice(1).map((b, index) => ({
      id: `smooth-${index}`, a: [...points[index]], b: [...b], cm: 15,
    })),
    settings: {
      show_borders: true, room_color: '#55606c',
      wall_fill: { c: '#ffffff', a: 1 }, fill_mode: 'custom',
      custom_fill: { c: '#607d8b', a: 0 },
    },
  };
}
