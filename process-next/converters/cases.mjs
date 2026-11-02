/** Small published-page journeys; fixtures remain synthetic and versioned. */
export const CONVERTER_URL = 'https://houseplan.tech/convert/';
export const CONVERTER_CASES = [
  { id: 'sh3d', file: 'flat-two-rooms.sh3d', title: 'Sweet Home 3D: published conversion and HA import',
    space: 'Первый этаж', rooms: ['Кухня', 'Спальня'], openings: ['door', 'window'], markers: 0 },
  { id: 'easy', file: 'easy-content.json', title: 'Easy Floorplan: published conversion and HA import',
    space: 'Full transfer', rooms: ['Room'], openings: ['door'], markers: 3 },
  { id: 'picture', file: 'picture-elements.yaml', title: 'picture-elements: published conversion and HA import',
    space: 'Ground floor', rooms: [], openings: [], markers: 11, width: 1600, height: 1000 },
];
