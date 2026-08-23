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
    // #263: пикер называет себя (`_bindingCandidates`) и потому находится
    // прямым совпадением. Регистрируются только чистые помощники надгробий:
    // смок не произносит ни одного их имени — он видит лишь список, который
    // они отфильтровали. Проверено зондом: правка одного `src/devices.ts` без
    // этой записи не выбирает ни одного смока.
    symbols: ['removedPlanBindings', 'isRemovedPlanEntity', 'deletePlanMarkerRecords'],
    smokes: ['smoke_binding_picker.mjs'],
    because: 'смок проверяет, что удалённая привязка снова предлагается в списке «Добавить», '
      + 'что отдельные сущности устройств живут за галкой и что надгробие устройства '
      + 'по-прежнему прячет его дочерние сущности (#262) — всё это следствия фильтров '
      + 'надгробий, чьи имена в браузерный сценарий не попадают',
  },
  {
    // #261: the browser observes the canonical wall/paper paths and downstream
    // geometries, while the pure bevel helpers remain internal to the bundle.
    symbols: ['multiWallBevelTriangles', 'multiWallBevelTrianglesAt'],
    smokes: ['smoke_junction_patch_resilience.mjs', 'smoke_multiwall_junction.mjs'],
    because: 'the #197 smoke probes the repaired exterior wedge across Plan, View, kiosk, '
      + 'Static, hidden Iso and light barriers, while the #249 smoke proves the old excessive '
      + 'wedge stays empty; neither browser scenario calls the pure bevel helpers by name',
  },
  {
    // #258: the browser sees only the resulting path/caches; it cannot call
    // the pure identity helpers by name through the production bundle.
    symbols: ['wallKey', 'lookupWall', 'canonicalKeyCoordinate', 'keyEpsilon'],
    smokes: ['smoke_wall_key_roundtrip.mjs'],
    because: 'the affected and canonical midpoint keys must produce the same T-junction in '
      + 'Plan, View, kiosk, Static, hidden Iso, clean-floor and light-barrier consumers',
  },
  {
    // #253: the pure interval transformer is invoked inside the resize preview;
    // the smoke can observe only the resulting wall records and rendered body.
    symbols: [
      'rekeyWallsAfterMove', 'WallEntry', 'angleClose', 'clampWallCm',
      'closePoint', 'distToSeg', 'keyOf', 'pointAt', 'segAngle', 'wallDir', 'wallEntry',
    ],
    smokes: ['smoke_resize_wall_thickness.mjs'],
    because: 'the real pointer-handler smoke proves that a partial overlap is split losslessly '
      + 'through live preview, commit, opening movement and Undo, but the browser bundle does '
      + 'not expose the pure transformer name to the scenario',
  },
  {
    // #244: pure repair/validation helpers are bundled behind editor actions;
    // the smoke observes their persisted candidate and rendered explanations.
    symbols: [
      'repairSpaceReferences', 'collectSpaceMarkerDependencies',
      'createSpaceDeletionCandidate', 'invalidDefaultFloor',
    ],
    smokes: ['smoke_orphan_space_references.mjs'],
    because: 'the production-bundle smoke proves the Optimize candidate, live marker rebuild, '
      + 'delete blocker and card-editor warning, while those UI surfaces do not expose the '
      + 'pure helper names at runtime',
  },
  {
    // #242: pure placement is called inside shared SVG/Iso renderers, while
    // browser smokes can only inspect the resulting transforms and bases.
    symbols: ['openingSymbolOffset'],
    smokes: ['smoke_isometric_contract.mjs', 'smoke_wall_thickness.mjs'],
    because: 'wall-thickness smoke proves the default and saved-flip SVG translations; '
      + 'isometric smoke inspects door/window/gate bases from the same helper, but neither '
      + 'browser bundle exposes the helper name in its test steps',
  },
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
