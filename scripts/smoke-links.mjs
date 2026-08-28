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
    symbols: [
      'LanguageRuntime', 'LanguageRuntimeContract', 'languageRenderGate',
      'dictionaryFor', 'ensureLanguage',
    ],
    smokes: ['smoke_german_locale.mjs'],
    because: 'the production-bundle scenario observes the lazy German chunk through network '
      + 'requests and four root render gates: neutral cold frame, atomic German commit, page-cache '
      + 'reuse and the bounded retry-to-English path cannot be proven from pure registry tests (#348)',
  },
  {
    symbols: ['quantizeKeyCoord', 'INCIDENT_EPS', 'KEY_FACTOR'],
    smokes: ['smoke_junction_limits.mjs'],
    because: 'the smoke proves the write barrier verdicts (refusal toasts, resize stop, '
      + 'fail-closed candidate) through the rendered card, never naming the key-quantisation '
      + 'internals that decide which nodes are one node (#331 §2.1)',
  },
  {
    symbols: [
      'EditorRuntimeLoader', 'EditorRuntimeLoaderState', 'EditorRuntimeModule',
      'EDITOR_RUNTIME_FINGERPRINT', 'createHouseplanEditorRuntime',
    ],
    smokes: ['smoke_lazy_editor_chunk.mjs'],
    because: 'the production-bundle scenario proves that the content-hashed editor chunk stays '
      + 'off the View network path, is shared by all three editors, retries once, and refuses an '
      + 'incompatible build before editor state is installed (#337)',
  },
  {
    symbols: [
      'placeResizeAreaLabel', 'resizeInwardNormal', 'resizeMeasuredEdges',
      'ResizeAreaPlacement', 'ResizeAreaPlacementInput', 'ResizeLabelView',
    ],
    smokes: ['smoke_resize_labels.mjs'],
    because: 'the #300 production gesture observes the pure projection only through the '
      + 'rendered side-wall highlights, area/leader DOM and actual gear rectangles at current zoom',
  },
  {
    symbols: [
      'classifyNearAxisSegment', 'snapNearAxisEndpoint', 'repairNearAxisRoomWalls',
      'NEAR_AXIS_MAX_DEGREES', 'NEAR_AXIS_MAX_SLOPE',
    ],
    smokes: ['smoke_plan_drawing_repairs.mjs', 'smoke_near_axis_optimize.mjs'],
    because: 'the production bundle must make the Walls hover/click candidate exact-axis, then '
      + 'preview one deduplicated real shared wall, pass production geometry preflight, apply one '
      + 'atomic Optimize write, reload idempotently and restore the original through one Undo (#290)',
  },
  {
    // #297: обход не проверяет снимок — он расшатывает план продуктовыми жестами
    // и спрашивает инварианты после каждого. Поиском по тексту связь между этим
    // смоком и кодом ресайза, удаления комнаты и «Оптимизировать» не находится.
    symbols: [
      'resolveSafeResize', 'applySafeResize', 'clampSafeResize', 'validateSafeResize',
      'planRoomDeletion', 'materializeWallIntervals', 'optimizePlans',
      'reconcileCoincidentPartitions',
    ],
    smokes: ['smoke_edit_walk.mjs'],
    because: 'дефекты геометрии рождаются в редактировании, а не в хранении: #289, #296 и '
      + '#298 прошли все снимковые гейты — обход находит их на первом-втором жесте',
  },
  {
    // #285: смок не произносит ни одного имени продуктового кода — он подставляет
    // геометрию реального этажа и спрашивает сам продукт через isPointInFill,
    // есть ли кладка там, где модель её обещает. Поиском по тексту такая связь
    // не находится никогда.
    symbols: [
      'wallBodiesGeometry', 'wallEdgeBodies', 'buildMultiWallNodeMap',
      'multiWallBevelTriangles', 'virtualJunctionPatches', 'linearWallJoinPatches',
      'MITRE_LIMIT', 'MULTI_WALL_JOIN_LIMIT', 'insetContour', 'atomicPolyForRoom',
    ],
    smokes: ['smoke_real_plan_masonry.mjs'],
    because: 'на реальном плане кладка рвётся там, где синтетические фикстуры целы: '
      + 'восемь закрытых задач по стыкам вошли в beta.9, а разрыв в 45 шагов остался — '
      + 'пиксельные пороги golden такую долю кадра не видят',
  },
  {
    symbols: [
      'WallGeometryStatus', 'WallGeometryComponent', 'WallBodiesGeometryResult',
      'checkSpacePhysicalGeometry', 'spacePhysicalGeometryFingerprint',
    ],
    smokes: ['smoke_wall_union_isolation.mjs'],
    because: 'the #278 production bundle must paint isolated canonical components in Plan, '
      + 'View, Static, hidden Iso and light barriers, reject a physical write with zero WS/Undo, '
      + 'and still allow a non-geometry edit on the same degraded legacy space',
  },
  {
    symbols: [
      'resolveSafeResize', 'applySafeResize', 'validateSafeResize', 'clampSafeResize',
      'safeResizePointerDisplacement', 'SafeResizePlan', 'SafeResizeResolution',
      'SafeResizeReason', 'SafeResizeObstacle',
    ],
    smokes: ['smoke_room_resize.mjs', 'smoke_resize_pointer_real_plan.mjs'],
    because: 'the #277 synthetic scenario covers fixed topology, first-corner clamp and disabled '
      + 'accessibility, while #293 recreates the card from config/get and drives real browser mouse '
      + 'events on the tracked second-floor plan; pure helpers are hidden behind both controllers',
  },
  {
    symbols: ['reconcileCoincidentPartitions', 'CoincidentPartitionResult'],
    smokes: ['smoke_optimize_coincident_partition.mjs'],
    because: 'the production-bundle scenario observes the Optimize report, atomic Apply, reload, '
      + 'one-shot Undo and the resulting Boundary/Thickness targets, while the pure reconciliation '
      + 'helper is not exposed on the card instance (#276)',
  },
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
    symbols: [
      'multiWallBevelTriangles', 'multiWallBevelTrianglesAt',
      'buildMultiWallNodeMap', 'MultiWallNodeRay', 'MultiWallNodeRaySupport',
      'multiWallProtectedRayIndexes', 'multiWallProtectedStripGeometry',
      'multiWallProtectedMapGeometry', 'multiWallEffectiveCutGeometry',
    ],
    smokes: [
      'smoke_junction_patch_resilience.mjs', 'smoke_multiwall_junction.mjs',
      'smoke_multiwall_strip_containment.mjs',
    ],
    because: 'the #197 smoke probes the repaired exterior wedge across Plan, View, kiosk, '
      + 'Static, hidden Iso and light barriers, while the #249 smoke proves the old excessive '
      + 'wedge stays empty, #271 also proves finite ray endpoints, and #275 densely samples every '
      + 'protected orthogonal strip across Plan, Static, hidden Iso and light barriers; the browser '
      + 'scenarios call none of the pure helpers by name',
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
    smokes: ['smoke_resize_wall_thickness.mjs', 'smoke_resize_pointer_real_plan.mjs'],
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
      'ImportLineageRoot', 'canonicalImportRoot', 'reversibleStem', 'addCandidate',
    ],
    smokes: ['smoke_orphan_space_references.mjs'],
    because: 'the production-bundle smoke proves the Optimize candidate, live marker rebuild, '
      + 'nested import-lineage collapse, delete blocker and card-editor warning, while those UI '
      + 'surfaces do not expose the pure helper names at runtime',
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
