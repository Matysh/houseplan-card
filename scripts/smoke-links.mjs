/**
 * Явные связи «символ продуктового кода → browser-smoke» (#241).
 *
 * Зачем реестр вообще нужен. Смоки не импортируют исходники: они грузят
 * собранный бандл и работают через DOM и приватные поля в `page.evaluate`.
 * Поэтому граф импортов их не свяжет, а совпадение идентификаторов находит
 * только те смоки, которые называют затронутый символ своим именем. Смок,
 * проверяющий тот же контракт через другое поле, не найдётся никаким поиском —
 * и ровно на таком смоке #234 потерял регресс.
 *
 * Что сюда попадает. Связь, которую нельзя доказать текстом: смок проверяет
 * следствие контракта, не называя ни одного изменённого символа. Каждая запись
 * обязана объяснять, ЧТО именно проверяет смок — иначе реестр превращается в
 * список суеверий, который никто не решается почистить.
 *
 * Чего сюда писать НЕ надо. Связи, которые и так находятся по имени: запись
 * рядом с прямым совпадением делает вывод selector'а неотличимым от «нашли
 * потому что записали», и тест начинает проходить по неверной причине.
 */

/**
 * @typedef {object} SmokeLink
 * @property {string[]} symbols Изменённые символы, включающие связь.
 * @property {string[]} smokes  Файлы в `demo/`, без пути.
 * @property {string}   because Что смок проверяет и почему поиском не найдётся.
 */

/** @type {SmokeLink[]} */
export const SMOKE_LINKS = [
  {
    // #234: единый резолвер толщины отрезка цепочки. Смок перехода между
    // толщинами не называет ни `chainSegmentCms`, ни `_draftSegmentCms` — он
    // рисует стены инструментом и проверяет, что кладка на стыке толщин
    // остаётся связной. Общих с диффом символов у него ровно два, `_cellCm` и
    // `_gridPitch`, и оба слишком широкие, чтобы что-то доказывать.
    symbols: ['chainSegmentCms', 'wallChainSegments', '_draftSegmentCms', '_closingWallCm'],
    smokes: ['smoke_wall_thickness_transition.mjs'],
    because: 'переход между двумя толщинами в одной цепочке: резолвер толщины '
      + 'отрезка решает, где кладка меняет глубину, а смок проверяет кладку, '
      + 'а не толщину, и ни одного имени из резолвера не называет',
  },
];

/** Смоки, связанные с изменёнными символами через реестр. */
export function registeredSmokes(changedSymbols) {
  const changed = new Set(changedSymbols);
  const out = new Map();
  for (const link of SMOKE_LINKS) {
    const hit = link.symbols.filter((symbol) => changed.has(symbol)).sort();
    if (!hit.length) continue;
    for (const smoke of link.smokes) {
      const entry = out.get(smoke) || { smoke, symbols: [], because: [] };
      entry.symbols = [...new Set([...entry.symbols, ...hit])].sort();
      if (!entry.because.includes(link.because)) entry.because.push(link.because);
      out.set(smoke, entry);
    }
  }
  return [...out.values()].sort((a, b) => a.smoke.localeCompare(b.smoke));
}
