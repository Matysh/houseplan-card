// Склейка нескольких `<path>` одного символа в один `d` (#584).
//
// У каждого исходного `path` своя текущая точка, и начинается она в нуле. При
// простой конкатенации `d` (так генератор и делал) второй путь, начинающийся
// относительной командой `m`, продолжает координаты первого — рисунок уезжает.
// Подтверждено на `coffee_table_round` и `table_round`: внутренние детали
// смещались относительно исходного SVG и могли выйти за `viewBox`.
//
// Канонизируется РОВНО начальный `moveto` каждого пути. Всё остальное внутри
// пути обязано сохранить смысл: после относительного `m` неявные пары координат
// — это относительные `l`, и превращать их в абсолютные нельзя.
//
// Приём подсказан патчем в поставке дизайнера (`fix-584-1`); реализация и
// свидетели здесь свои.

const NUMBER = '[-+]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)(?:[eE][-+]?\\d+)?';
const INITIAL_RELATIVE = new RegExp(`^m\\s*(${NUMBER})[\\s,]*(${NUMBER})`);

export function joinFurniturePaths(paths) {
  if (!Array.isArray(paths) || !paths.length) throw new Error('Furniture SVG has no paths');
  return paths.map((value) => {
    const d = String(value).trim();
    if (d.startsWith('M')) return d;
    const match = INITIAL_RELATIVE.exec(d);
    if (!match) throw new Error('Furniture path must begin with M or m');
    const tail = d.slice(match[0].length).replace(/^[\s,]+/, '');
    // Неявные пары после `m` — относительные линии; без явной `l` они достались
    // бы канонизированному `M` и стали бы абсолютными.
    const implicitLine = tail && !/^[A-Za-z]/.test(tail) ? 'l ' : '';
    return `M ${match[1]} ${match[2]} ${implicitLine}${tail}`;
  }).join(' ');
}
