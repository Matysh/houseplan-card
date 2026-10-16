import { easyFurnitureSymbol } from './easy-catalog.mjs';

const positive = (number) => typeof number === 'number' && Number.isFinite(number) && number > 0;
const median = (numbers) => {
  const sorted = numbers.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** An initial estimate, never a measurement or a demand for user calibration. */
export function estimateEasyScale(floors, furnitureDefaults = []) {
  const doors = floors.flatMap((floor) => floor.openings || [])
    .filter((opening) => opening.type === 'door' && (!opening.motion || opening.motion === 'swing')
      && (!opening.sash || opening.sash === 'single') && positive(opening.length))
    .map((opening) => opening.length);
  if (doors.length) return { cmPerUnit: 90 / median(doors), basis: 'doors', count: doors.length };

  const defaults = new Map(furnitureDefaults.map((item) => [item.id, item]));
  const ratios = [];
  for (const floor of floors) {
    for (const item of floor.furniture || []) {
      if (['rug', 'stairs'].includes(item.type)) continue;
      const reference = defaults.get(easyFurnitureSymbol(item.type));
      if (!reference || !positive(item.w) || !positive(item.h)) continue;
      // Orientation is display state, not a way to change physical scale.
      const a = [item.w, item.h].sort((x, y) => x - y);
      const b = [reference.w, reference.h].sort((x, y) => x - y);
      if (b.every(positive)) ratios.push(b[0] / a[0], b[1] / a[1]);
    }
  }
  if (ratios.length) return { cmPerUnit: median(ratios), basis: 'furniture', count: ratios.length / 2 };
  return { cmPerUnit: 1, basis: 'default', count: 0 };
}
