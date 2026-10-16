/** Explicit source-to-existing-HP symbols, pinned source: Easy 7a25bcf. */
export const EASY_FURNITURE = Object.freeze({
  table: 'table_dining', roundTable: 'table_round', desk: 'desk', chair: 'chair',
  sofa: 'sofa', bed: 'bed_double', wardrobe: 'wardrobe', dresser: 'nightstand',
  tallDresser: 'wardrobe', ladderShelf: 'shelf_floor', bookcase: 'bookshelf',
  rug: 'rug', plant: 'plant', indoorPalm: 'plant', fridge: 'fridge', stove: 'stove',
  sink: 'sink', toilet: 'toilet', stairs: 'stairs', tv: 'tv', washer: 'washer',
  dryer: 'dryer', dishwasher: 'dishwasher', waterHeater: 'water_heater',
  airHandler: 'ac', bathtub: 'bathtub', vanity: 'sink', sectional: 'sofa_corner_right',
  quarterTub: 'bathtub_corner', cornerShowerCurved: 'shower',
});
export const EASY_APPROXIMATE_FURNITURE = new Set([
  'bed', 'dresser', 'tallDresser', 'ladderShelf', 'indoorPalm', 'vanity',
  'sectional', 'quarterTub', 'cornerShowerCurved',
]);

export function easyFurnitureSymbol(type) {
  return Object.hasOwn(EASY_FURNITURE, type) ? EASY_FURNITURE[type] : null;
}
