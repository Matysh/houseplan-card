const CELL_CM = 5;
const point = (x, y) => [x / 240, y / 240];

const roomAt = (id, x, y) => {
  const poly = [point(x, y), point(x + 24, y), point(x + 24, y + 24), point(x, y + 24)];
  const wallIds = poly.map((_, index) => `${id}-wall-${index}`);
  return {
    room: { id, name: id, area: null, poly, wall_ids: wallIds },
    segments: poly.map((a, index) => ({
      id: wallIds[index], a, b: poly[(index + 1) % poly.length], cm: 15,
    })),
    walls: poly.map((a, index) => ({
      key: `${id}-legacy-${index}`, a, b: poly[(index + 1) % poly.length], cm: 15,
    })),
  };
};

const roomGrid = (prefix, xOffset = 0) => Array.from({ length: 12 }, (_, index) =>
  roomAt(`${prefix}-${index}`, xOffset + 8 + (index % 4) * 32, 8 + Math.floor(index / 4) * 32));

export const WALL_DRAW_CLICK_POINTS = [
  point(152, 144), point(176, 144), point(176, 168), point(200, 168),
  point(200, 144), point(224, 144), point(224, 168), point(236, 168),
];

export function makeWallDrawClickFixture(remoteVariant = false) {
  const primary = roomGrid('base');
  const remote = remoteVariant ? roomGrid('remote', 300) : [];
  const all = [...primary, ...remote];
  const roomDrafts = Array.from({ length: 4 }, (_, index) => ({
    id: `saved-draft-${index}`,
    points: [point(8 + index * 28, 112), point(20 + index * 28, 112), point(20 + index * 28, 124)],
    segments: [
      { id: `saved-draft-${index}-0`, cm: 15 },
      { id: `saved-draft-${index}-1`, cm: 15 },
    ],
  }));
  const edited = {
    id: 'edited', title: 'Wall draw click', cell_cm: CELL_CM,
    view_box: [0, 0, 1, 1],
    rooms: all.map((item) => item.room),
    wall_segments: all.flatMap((item) => item.segments),
    walls: all.flatMap((item) => item.walls),
    room_drafts: roomDrafts,
    partitions: [], wall_columns: [], openings: [], open_spans: [],
  };
  return {
    model_version: 9,
    spaces: [edited, ...Array.from({ length: 4 }, (_, index) => ({
      id: `other-${index}`, title: `Other ${index}`, cell_cm: CELL_CM,
      view_box: [0, 0, 1, 1], rooms: [], wall_segments: [], walls: [],
      room_drafts: [], partitions: [], wall_columns: [], openings: [], open_spans: [],
    }))],
    markers: [], settings: {},
  };
}
