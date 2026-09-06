import { makeWallDrawClickFixture, WALL_DRAW_CLICK_POINTS } from './fixtures/wall-draw-click.mjs';

export async function installWallDrawClickHarness(page) {
  await page.evaluate(() => {
    const card = window.__card;
    if (!window.__wallDrawOriginals) {
      window.__wallDrawOriginals = {
        physical: card._checkSpacePhysicalGeometry.bind(card),
        junction: card._junctionLimitViolations.bind(card),
        save: card._saveConfigDebounced,
        genericCommit: card._editorRuntime._commitPhysicalGeometry.bind(card._editorRuntime),
      };
      card._editorRuntime._commitPhysicalGeometry = (name, before, ...rest) => {
        const metrics = window.__wallDrawMetrics;
        if (metrics && name === card._t('history.wall_segment')) {
          metrics.wallGenericFallbacks += 1;
          if (!metrics.fallbackSample) {
            const space = card._serverCfg?.spaces?.find((item) => item.id === before?.spaceId);
            const stable = (value) => JSON.stringify(value ?? null);
            const arrays = [
              'rooms', 'openings', 'walls', 'wall_segments', 'open_spans',
              'partitions', 'wall_columns', 'decor',
            ];
            metrics.fallbackSample = JSON.parse(JSON.stringify({
              modelVersion: card._serverCfg?.model_version,
              chainId: card._activeWallChainId,
              activePartitionIds: card._activeWallChainPartitionIds,
              beforePartitions: before?.partitions,
              afterPartitions: space?.partitions,
              beforeTransform: before?.plan_transform,
              afterTransform: Object.fromEntries([
                'plan_x', 'plan_y', 'plan_scale', 'plan_scale_x', 'plan_scale_y', 'plan_angle',
              ].filter((key) => space?.[key] !== undefined).map((key) => [key, space[key]])),
              changedArrays: arrays.filter((key) =>
                stable(before?.[key] ?? []) !== stable(space?.[key] ?? [])),
            }));
          }
        }
        return window.__wallDrawOriginals.genericCommit(name, before, ...rest);
      };
      card._checkSpacePhysicalGeometry = (config, ...rest) => {
        const metrics = window.__wallDrawMetrics;
        if (metrics) {
          const local = config?.spaces?.length === 1;
          metrics[local ? 'localPhysicalChecks' : 'fullSpacePhysicalChecks'] += 1;
          if (local) {
            const space = config.spaces[0] || {};
            const count = ['wall_segments', 'partitions', 'wall_columns']
              .reduce((sum, key) => sum + (space[key]?.length || 0), space.rooms?.length || 0);
            metrics.localProofMaxObjects = Math.max(metrics.localProofMaxObjects, count);
          }
        }
        return window.__wallDrawOriginals.physical(config, ...rest);
      };
      card._junctionLimitViolations = (config, spaceId, geometry, roomIds) => {
        const metrics = window.__wallDrawMetrics;
        if (metrics) {
          metrics.junctionPasses += 1;
          if (geometry) metrics.junctionArtifactPasses += 1;
        }
        return window.__wallDrawOriginals.junction(config, spaceId, geometry, roomIds);
      };
      const countedSave = () => {
        if (window.__wallDrawMetrics) window.__wallDrawMetrics.configWrites += 1;
      };
      countedSave.cancel = () => {};
      countedSave.flush = () => {};
      card._saveConfigDebounced = countedSave;
    }
  });
}

export async function resetWallDrawClickHarness(page, remoteVariant = false) {
  const fixture = makeWallDrawClickFixture(remoteVariant);
  return page.evaluate(async (config) => {
    const card = window.__card;
    card._clearGeometryGesture();
    card._serverCfg = JSON.parse(JSON.stringify(config));
    card._space = 'edited'; card._layout = {};
    card._cfgEpoch += 1; card._modelCache = null; card._wallUnionCache = null;
    card._physicalBodiesCache = null; card._frame = null;
    card._pendingPhysicalWrites.clear(); card._geometryHistory.clear();
    card._activeWallChainId = null; card._activeWallChainPartitionIds = [];
    card._path = []; card._wallChainSegmentCms = []; card._wallChainRedo = [];
    card._toast = ''; card._mode = 'plan'; card._tool = 'draw'; card._drawWallField = '15';
    window.__wallDrawMetrics = {
      fullSpacePhysicalChecks: 0, localPhysicalChecks: 0,
      junctionPasses: 0, junctionArtifactPasses: 0,
      configWrites: 0, localProofMaxObjects: 0,
      wallGenericFallbacks: 0, fallbackSample: null,
    };
    card.requestUpdate(); await card.updateComplete;
    return {
      spaces: card._serverCfg.spaces.length,
      rooms: card._curSpaceCfg.rooms.length,
      positiveSegments: card._curSpaceCfg.wall_segments.filter((item) => item.cm > 0).length,
      savedPartitions: card._curSpaceCfg.partitions.filter(
        (item) => item.id.startsWith('saved-partition-'),
      ).length,
    };
  }, fixture);
}

export async function runWallDrawClickChain(page) {
  return page.evaluate(async (normalizedPoints) => {
    const card = window.__card;
    const metrics = window.__wallDrawMetrics;
    const stage = (card.shadowRoot || card.renderRoot).querySelector('.stage');
    const eventAt = (normalized) => {
      const point = normalized.map((value) => value * 1000);
      const rect = stage.getBoundingClientRect();
      const view = card._viewOr(card._baseVb());
      return new MouseEvent('click', {
        clientX: rect.left + ((point[0] - view.x) / view.w) * rect.width,
        clientY: rect.top + ((point[1] - view.y) / view.h) * rect.height,
        bubbles: true,
      });
    };
    const snapshots = () => ({
      ...metrics, history: card._geometryHistory.size,
      pathPoints: card._path.length,
    });
    const delta = (after, before) => Object.fromEntries(
      Object.keys(after).map((key) => [key, after[key] - before[key]]),
    );

    const firstBefore = snapshots();
    card._markupClick(eventAt(normalizedPoints[0]));
    const first = delta(snapshots(), firstBefore);
    const times = []; const clicks = [];
    for (const normalized of normalizedPoints.slice(1)) {
      const before = snapshots();
      const started = performance.now();
      card._markupClick(eventAt(normalized));
      times.push(performance.now() - started);
      clicks.push(delta(snapshots(), before));
    }
    const ids = [...card._activeWallChainPartitionIds];
    const terminalBefore = snapshots();
    card._activateMarkupTool('select');
    const terminal = delta(snapshots(), terminalBefore);
    await card.updateComplete;
    return {
      first, clicks, times, ids,
      terminal,
      terminalPartitionCount: card._curSpaceCfg.partitions?.length || 0,
      activeCleared: !card._activeWallChainId
        && card._activeWallChainPartitionIds.length === 0 && card._path.length === 0,
      metrics: { ...metrics },
    };
  }, WALL_DRAW_CLICK_POINTS);
}
